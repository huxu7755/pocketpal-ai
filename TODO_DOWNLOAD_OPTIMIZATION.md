# LLM Hub 下载优化待处理清单

## 📅 创建日期
2026-04-28

## 📋 修改内容总结

### 1. 优化目标
- 将下载速度从 ~204 KB/s 提升至 ~800 KB/s+
- 提升下载稳定性和用户体验

### 2. 需要修改的文件

| 文件路径 | 修改类型 | 修改内容 | 优先级 |
|---------|---------|---------|--------|
| `android/app/src/main/java/com/llmhub/llmhub/data/ModelDownloader.kt` | 修改 | 添加多线程分片下载逻辑 | 高 |
| `android/app/src/main/java/com/llmhub/llmhub/viewmodels/ModelDownloadViewModel.kt` | 修改 | 集成多线程下载器 | 高 |
| `android/app/build.gradle.kts` | 修改 | 添加 OkHttp 依赖 | 高 |
| `android/app/src/main/java/com/llmhub/llmhub/data/MultiThreadDownloader.kt` | 新增 | 独立多线程下载器类 | 中 |

### 3. 核心修改方案

#### 3.1 多线程分片下载
```kotlin
// 分片配置
val chunkCount = 4  // 4个并发线程
val chunkSize = totalSize / chunkCount

// 并行下载所有分片
coroutineScope {
    (0 until chunkCount).map { chunkIndex ->
        async {
            downloadChunk(url, chunkIndex * chunkSize, chunkSize)
        }
    }.awaitAll()
}

// 使用 Range 请求下载分片
val request = Request.Builder()
    .url(url)
    .header("Range", "bytes=${start}-${end}")
    .build()
```

#### 3.2 缓冲区优化
```kotlin
val buffer = ByteArray(8 * 1024 * 1024) // 8MB 缓冲区（原 8KB）
```

#### 3.3 OkHttp 配置
```kotlin
// build.gradle.kts 添加依赖
implementation("com.squareup.okhttp3:okhttp:4.12.0")

// OkHttp 客户端配置
val okHttpClient = OkHttpClient.Builder()
    .connectTimeout(30, TimeUnit.SECONDS)
    .readTimeout(60, TimeUnit.SECONDS)
    .writeTimeout(60, TimeUnit.SECONDS)
    .build()
```

### 4. 预期收益

| 指标 | 优化前 | 优化后 |
|------|-------|-------|
| 下载速度 | ~204 KB/s | ~800 KB/s+ |
| 并发数 | 1 | 4 |
| 缓冲区 | 8KB | 8MB |
| 稳定性 | 中等 | 高 |

### 5. 潜在风险与解决方案

| 风险 | 概率 | 解决方案 |
|------|------|---------|
| 并发写入冲突 | 低 | 使用 RandomAccessFile 分段写入 |
| 内存溢出 | 低 | 控制并发数和缓冲区大小 |
| 进度显示异常 | 中 | 使用 AtomicLong 累加进度 |
| 断点续传失效 | 低 | 下载前验证分片完整性 |
| 网络超时 | 中 | 添加超时重试机制 |

### 6. 实施步骤

```
阶段 1️⃣：基础实现
├── 添加 OkHttp 依赖
├── 创建 MultiThreadDownloader 类
├── 实现分片下载逻辑
└── 测试单文件下载稳定性

阶段 2️⃣：集成测试
├── 接入 ModelDownloadViewModel
├── 测试 UI 进度更新
└── 验证后台下载稳定性

阶段 3️⃣：优化完善
├── 添加错误重试机制
├── 实现速度限制
└── 完善日志和监控
```

### 7. 测试用例

| 测试场景 | 预期结果 |
|---------|---------|
| 正常网络下载 | 速度提升 3-4 倍 |
| 切换后台下载 | 下载继续，无中断 |
| 网络中断恢复 | 断点续传成功 |
| 大文件下载 (>1GB) | 稳定完成，内存正常 |
| 并发下载多个模型 | 无冲突，进度独立更新 |

### 8. 注意事项

1. **兼容性**：确保与现有代码逻辑兼容，特别是断点续传功能
2. **权限**：不需要新增权限
3. **性能**：建议在 UI 线程更新进度时使用节流，避免频繁刷新
4. **日志**：添加详细日志便于排查问题

---

## ✅ 待办清单

- [ ] 添加 OkHttp 依赖
- [ ] 创建 MultiThreadDownloader 类
- [ ] 修改 ModelDownloader 集成多线程下载
- [ ] 修改 ViewModel 接入新下载器
- [ ] 测试单线程下载功能
- [ ] 测试多线程下载功能
- [ ] 测试断点续传功能
- [ ] 测试后台下载稳定性
- [ ] 优化进度显示
- [ ] 添加错误处理和重试机制

---

**备注**：此文件为本地记录，不上传到远程仓库。修改前请确保代码备份。
