---
title: Rust 系统编程入门—从 unsafe 到安全工具开发
date: 2026-09-16 13:00:00
categories: [运维开发]
tags: [编程, Rust, 系统编程]
cover: https://cdn.jsdelivr.net/gh/TSVMV/TSVMV.github.io@main/source/img/bg30.jpg
---

很多人对 Rust 的印象停留在"安全、 borrow checker、学习曲线陡峭"。但在安全工具开发领域，Rust 真正的价值是：**它让你能写 C 级别的底层代码，同时不 segfault。**

你写过 pwntools 就知道 Python 做性能敏感的事情有多痛苦——解析大二进制文件、批量 fuzz、hook 系统调用，Python 永远慢半拍。Rust 刚好填了这个坑：编译成原生机器码，零成本抽象，内存安全，还有成熟的 FFI 可以和 C 库互操作。

这篇文章不讲 Rust 语法基础，直接讲写安全工具时最需要的东西：unsafe、FFI、进程注入、内存操作。

<!-- more -->

## 1. 为什么安全工具要用 Rust

先对比一下几个选项：

| 语言 | 性能 | 内存安全 | 开发效率 | 适合场景 |
|------|------|----------|----------|----------|
| C | 最快 | 无 | 低 | 内核模块、驱动 |
| C++ | 快 | 部分 | 中 | 大型逆向框架 |
| Python | 慢 | 有 | 高 | 脚本、exp |
| **Rust** | **快** | **有** | **中高** | **安全工具、CTF 框架** |
| Go | 中 | 有 | 高 | 后端服务、爬虫 |

Rust 做安全工具的核心优势：
- **内存安全**：写 parser、反序列化、hook 代码时不用担心 use-after-free
- **零成本抽象**：高阶函数、迭代器、泛型不影响性能
- **cross-compile**：交叉编译到 Windows/macOS/Linux 非常方便
- **FFI**：可以直接链接 C 库（libbfd、capstone、unicorn）
- **cargo**：包管理和构建系统吊打 make/cmake

## 2. unsafe：什么时候需要它

Rust 默认的安全检查覆盖了 99% 的场景。但写安全工具时，你经常需要：
- 操作原始指针（读进程内存）
- 调用 C 库函数（libc、unicorn）
- 实现 trait 时绕过 borrow checker
- 解析二进制格式时做位操作

这些都需要 `unsafe`。记住一个原则：**unsafe 是给抽象层用的，不是给业务代码用的。**

```rust
// 安全的 unsafe 用法：把不安全的操作封装在安全的 API 后面
use std::ptr;

pub struct MemoryReader {
    addr: *const u8,
}

impl MemoryReader {
    /// 安全的构造函数：检查指针非空
    pub fn new(addr: *const u8) -> Option<Self> {
        if addr.is_null() {
            None
        } else {
            Some(Self { addr })
        }
    }
    
    /// 安全的读取 API：返回 Result 而不是直接 panic
    /// # Safety
    /// 调用者必须保证 addr 指向至少 size 个有效字节
    pub unsafe fn read_bytes(&self, size: usize) -> Result<Vec<u8>, std::io::Error> {
        if size == 0 {
            return Ok(Vec::new());
        }
        let mut buf = vec![0u8; size];
        ptr::copy_nonoverlapping(self.addr, buf.as_mut_ptr(), size);
        Ok(buf)
    }
}
```

关键点：
- unsafe 块里的代码不保证安全，但**封装它的函数应该是安全的**
- 用 `# Safety` 文档注释说明调用者需要保证什么
- 能不 unsafe 就不 unsafe

## 3. FFI：调用 C 库

写安全工具最常见的需求是调用现成的 C 库。Rust 的 FFI（Foreign Function Interface）非常成熟。

### 3.1 声明外部函数

```rust
// 链接 libc 的 read 函数
extern "C" {
    fn read(fd: i32, buf: *mut c_void, count: size_t) -> isize;
    fn write(fd: i32, buf: *const c_void, count: size_t) -> isize;
    fn close(fd: i32) -> i32;
}

use libc::{c_void, size_t};

fn safe_read(fd: i32, buf: &mut [u8]) -> isize {
    unsafe { read(fd, buf.as_mut_ptr() as *mut c_void, buf.len()) }
}
```

### 3.2 链接系统库

在 `Cargo.toml` 中声明：

```toml
[dependencies]
libc = "0.2"

[build-dependencies]
cc = "1.0"
```

`build.rs` 中告诉 cargo 链接系统库：

```rust
fn main() {
    println!("cargo:rustc-link-lib=dylib=bfd");   // 链接 libbfd
    println!("cargo:rustc-link-lib=dylib=opcodes"); // 链接 libopcodes
}
```

### 3.3 调用 Unicorn Engine

Unicorn 是 CTF pwn 最常用的 CPU 模拟器，Rust 有官方绑定：

```rust
use unicorn_engine::{Unicorn, Arch, Mode};
use unicorn_engine::RegisterX86;

fn emulate_shellcode() -> Result<(), Box<dyn std::error::Error>> {
    let mut uc = Unicorn::new(Arch::X86, Mode::MODE_64)?;
    
    // 映射内存
    let addr = 0x1000_0000;
    uc.mem_map(addr, 2 * 1024 * 1024, unicorn_engine::PROT_ALL)?;
    
    // 写入 shellcode
    let shellcode: Vec<u8> = hex::decode("4831ff4831f64831d20f05")?; // xor rdi,rdi; xor rsi,rsi; xor rdx,rdx; syscall
    uc.mem_write(addr, &shellcode)?;
    
    // 设置寄存器
    uc.reg_write(RegisterX86::RAINTO, 60)?; // exit syscall
    
    // 开始模拟
    uc.emu_start(addr, addr + shellcode.len() as u64, 0, 0)?;
    
    Ok(())
}
```

## 4. 解析二进制格式

写 ELF/PE parser 是 CTF 工具开发的基本功。Rust 的 `byteorder` 和 `binread` crate 让这个过程非常优雅。

### 4.1 手动解析 ELF 头

```rust
use byteorder::{ByteOrder, LittleEndian};

#[derive(Debug)]
#[repr(C)]
pub struct Elf64Header {
    pub e_ident: [u8; 16],
    pub e_type: u16,
    pub e_machine: u16,
    pub e_version: u32,
    pub e_entry: u64,
    pub e_phoff: u64,
    pub e_shoff: u64,
    pub e_flags: u32,
    pub e_ehsize: u16,
    pub e_phentsize: u16,
    pub e_phnum: u16,
    // ...
}

impl Elf64Header {
    pub fn parse(data: &[u8]) -> Result<Self, &'static str> {
        if data.len() < 64 || &data[..4] != b"\x7fELF" {
            return Err("不是有效的 ELF 文件");
        }
        
        Ok(Self {
            e_ident: data[..16].try_into().unwrap(),
            e_type: LittleEndian::read_u16(&data[16..18]),
            e_machine: LittleEndian::read_u16(&data[18..20]),
            e_version: LittleEndian::read_u32(&data[20..24]),
            e_entry: LittleEndian::read_u64(&data[24..32]),
            e_phoff: LittleEndian::read_u64(&data[32..40]),
            e_shoff: LittleEndian::read_u64(&data[40..48]),
            e_flags: LittleEndian::read_u32(&data[48..52]),
            e_ehsize: LittleEndian::read_u16(&data[52..54]),
            e_phentsize: LittleEndian::read_u16(&data[54..56]),
            e_phnum: LittleEndian::read_u16(&data[56..58]),
        })
    }
}
```

### 4.2 用 goblin crate

`goblin` 是 Rust 生态最好的二进制解析库，支持 ELF/PE/Mach-O：

```rust
use goblin::elf::{Elf, program_header::PT_LOAD};

fn analyze_elf(data: &[u8]) -> Result<(), Box<dyn std::error::Error>> {
    let elf = Elf::parse(data)?;
    
    println!("入口点: {:#x}", elf.entry);
    println!("架构: {:?}", elf.header.e_machine);
    
    for ph in elf.program_headers.iter() {
        if ph.p_type == PT_LOAD {
            println!(
                "LOAD: vaddr={:#x} memsz={:#x} flags={}",
                ph.p_vaddr, ph.p_memsz, ph.p_flags
            );
        }
    }
    
    for sym in elf.syms.iter() {
        if !sym.st_name.is_empty() {
            if let Ok(name) = elf.strtab.get_at(sym.st_name) {
                println!("符号: {} @ {:#x}", name, sym.st_value);
            }
        }
    }
    
    Ok(())
}
```

## 5. 进程内存读取

写调试器或内存扫描工具时，需要读取其他进程的内存。Linux 上通过 `/proc/<pid>/mem`。

```rust
use std::io::{Read, Seek, SeekFrom};
use std::fs::File;

pub struct ProcessMemory {
    mem_file: File,
}

impl ProcessMemory {
    pub fn attach(pid: u32) -> std::io::Result<Self> {
        let mem_file = File::open(format!("/proc/{}/mem", pid))?;
        Ok(Self { mem_file })
    }
    
    pub fn read<T>(&mut self, addr: usize) -> std::io::Result<T> {
        self.mem_file.seek(SeekFrom::Start(addr as u64))?;
        let mut buf = std::mem::MaybeUninit::<T>::uninit();
        unsafe {
            std::ptr::copy_nonoverlapping(
                &mut buf as *mut _ as *mut u8,
                buf.as_mut_ptr() as *mut u8,
                std::mem::size_of::<T>(),
            );
            self.mem_file.read_exact(std::slice::from_raw_parts_mut(
                buf.as_mut_ptr() as *mut u8,
                std::mem::size_of::<T>(),
            ))?;
            Ok(buf.assume_init())
        }
    }
    
    pub fn read_bytes(&mut self, addr: usize, size: usize) -> std::io::Result<Vec<u8>> {
        self.mem_file.seek(SeekFrom::Start(addr as u64))?;
        let mut buf = vec![0u8; size];
        self.mem_file.read_exact(&mut buf)?;
        Ok(buf)
    }
}
```

## 6. 写一个简单的 PE 注入器

```rust
use std::process::Child;

pub fn inject_shellcode(child: &mut Child, shellcode: &[u8]) -> std::io::Result<()> {
    use libc::{c_void, iovec, process_vm_writev};
    
    // 在目标进程中分配内存
    let remote_mem = unsafe {
        libc::mmap(
            std::ptr::null_mut(),
            shellcode.len(),
            libc::PROT_READ | libc::PROT_WRITE | libc::PROT_EXEC,
            libc::MAP_PRIVATE | libc::MAP_ANONYMOUS,
            -1,
            0,
        )
    };
    
    if remote_mem == libc::MAP_FAILED {
        return Err(std::io::Error::last_os_error());
    }
    
    // 写入 shellcode
    let local_iov = iovec {
        iov_base: shellcode.as_ptr() as *mut c_void,
        iov_len: shellcode.len(),
    };
    let remote_iov = iovec {
        iov_base: remote_mem,
        iov_len: shellcode.len(),
    };
    
    unsafe {
        process_vm_writev(child.id() as i32, &local_iov, 1, &remote_iov, 1, 0);
    }
    
    // 创建远程线程执行 shellcode
    // ...
    Ok(())
}
```

## 7. 性能优化

写安全工具时经常要处理大量数据（fuzz 输出、网络包、磁盘文件）。Rust 的性能优化点：

### 7.1 零拷贝

```rust
// 不好：每次都分配新 Vec
fn parse_lines_slow(data: &[u8]) -> Vec<&str> {
    data.split(|&b| b == b'\n')
        .map(|line| std::str::from_utf8(line).unwrap())
        .collect()
}

// 好：返回引用，不分配
fn parse_lines_fast(data: &[u8]) -> impl Iterator<Item = &str> {
    data.split(|&b| b == b'\n')
        .filter_map(|line| std::str::from_utf8(line).ok())
}
```

### 7.2 并行处理

```rust
use rayon::prelude::*;

fn analyze_files(files: Vec<PathBuf>) -> Vec<AnalysisResult> {
    files.par_iter()  // 自动并行
        .map(|path| analyze_single_file(path))
        .collect()
}
```

### 7.3 避免 clone

```rust
// 不好
fn process(data: Vec<u8>) {
    let copy = data.clone();
    // ...
}

// 好：传引用
fn process(data: &[u8]) {
    // ...
}
```

## 8. 工程实践

### 8.1 错误处理

安全工具不能随便 panic。用 `thiserror` 定义错误类型：

```rust
#[derive(Debug, thiserror::Error)]
pub enum ToolError {
    #[error("ELF 解析失败: {0}")]
    ElfParse(#[from] goblin::error::Error),
    
    #[error("IO 错误: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("内存映射失败")]
    MmapFailed,
    
    #[error("不支持的架构: {0}")]
    UnsupportedArch(String),
}

pub type Result<T> = std::result::Result<T, ToolError>;
```

### 8.2 CLI 工具

用 `clap` 写命令行工具：

```rust
use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "mytool")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// 分析 ELF 文件
    Analyze {
        /// 目标文件路径
        file: String,
        /// 详细输出
        #[arg(short, long)]
        verbose: bool,
    },
    /// 注入 shellcode
    Inject {
        /// 目标 PID
        pid: u32,
        /// shellcode 文件
        shellcode: String,
    },
}
```

## 总结

Rust 在安全工具开发中的定位很清晰：**比 Python 快，比 C 安全，比 Go 更底层。** 写 CTF exp、逆向框架、fuzzer、调试器，Rust 都是很好的选择。

入门路径建议：
1. 先学 Rust 基础语法（所有权、借用、生命周期）
2. 写几个小工具：ELF parser、PE parser、简单的 disassembler
3. 学习 FFI 和 unsafe 的正确用法
4. 读优秀的 Rust 安全工具源码：goblin、capstone-rs、unicorn-rs

Rust 的学习曲线确实陡，但一旦过了那个坎，你会发现写底层代码变得前所未有的安心——编译器帮你把所有内存安全问题都挡住了，你只需要专注于逻辑本身。
