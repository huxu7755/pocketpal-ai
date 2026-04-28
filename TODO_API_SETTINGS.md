
# API 设置功能待处理清单

---

## 📋 功能需求

### 界面设计
- **标题**: API 服务设置
- **开关**: 启用 Ollama API 服务
- **地址**: http://127.0.0.1:11434（可编辑）
- **API Key**: 输入框（用户可自定义或生成随机 Key）
  - 生成随机 Key 按钮
  - 清空按钮
  - 提示：留空则不验证 API Key
- **跨域**: 允许局域网访问（开关）
- **测试按钮**: 测试 API 连通性

### 核心特性
1. **端口冲突检测**: 自动检测端口是否被占用，自动推荐可用端口
2. **API Key 认证**: 设置了 Key 才验证，默认为空不验证
3. **双向访问**: 支持本机访问和局域网访问

---

## 📁 需要修改的文件

| 文件路径 | 类型 | 说明 | 状态 |
|---------|------|------|------|
| `android/app/src/main/java/com/llmhub/llmhub/screens/SettingsScreen.kt` | 修改 | 添加 API 设置界面（开关、地址、API Key、测试按钮） | 待处理 |
| `android/app/src/main/java/com/llmhub/llmhub/viewmodels/ApiSettingsViewModel.kt` | 新增 | 管理 API 服务状态、端口检测、API Key 管理 | 待处理 |
| `android/app/src/main/java/com/llmhub/llmhub/service/ApiService.kt` | 新增 | 启动/停止本地 API 服务器、端口检测、API Key 验证 | 待处理 |
| `android/app/src/main/java/com/llmhub/llmhub/service/ApiServer.kt` | 新增 | HTTP 服务器实现（Ktor）、OpenAI 兼容 API | 待处理 |
| `android/app/src/main/java/com/llmhub/llmhub/utils/PortUtils.kt` | 新增 | 端口检测工具类 | 待处理 |
| `android/app/src/main/res/values/strings.xml` | 修改 | 添加 API 设置相关字符串资源 | 待处理 |

---

## 🔧 核心实现方案

### 1. 端口检测工具类
```kotlin
object PortUtils {
    fun isPortAvailable(port: Int): Boolean {
        return try {
            ServerSocket(port).use { true }
        } catch (e: IOException) {
            false
        }
    }
    
    fun findAvailablePort(startPort: Int, maxAttempts: Int = 10): Int {
        var port = startPort
        repeat(maxAttempts) {
            if (isPortAvailable(port)) return port
            port++
        }
        throw IllegalStateException("No available port found")
    }
}
```

### 2. API 服务类（含 API Key 支持）
```kotlin
class ApiService(private val context: Context) {
    private var server: ApiServer? = null
    private var currentApiKey: String? = null
    
    fun startServer(host: String, port: Int, apiKey: String?, allowLocalNetwork: Boolean): StartResult {
        // 端口检测
        if (!PortUtils.isPortAvailable(port)) {
            val availablePort = PortUtils.findAvailablePort(port)
            return StartResult.PortConflict(availablePort)
        }
        
        // 保存 API Key
        currentApiKey = apiKey
        
        // 启动服务器
        server = ApiServer(host, port, apiKey)
        server?.start()
        return StartResult.Success(port)
    }
    
    fun stopServer() { server?.stop(); server = null; currentApiKey = null }
    fun isRunning(): Boolean = server?.isRunning ?: false
    fun generateRandomKey(): String = "sk-" + UUID.randomUUID().toString().replace("-", "")
    
    sealed class StartResult {
        data class Success(val port: Int) : StartResult()
        data class PortConflict(val suggestedPort: Int) : StartResult()
        object PermissionDenied : StartResult()
        object NetworkError : StartResult()
    }
}
```

### 3. HTTP 服务器（含认证中间件）
```kotlin
class ApiServer(host: String, port: Int, private val apiKey: String?) {
    private val server = embeddedServer(Netty, port = port, host = host) {
        routing {
            route("/v1") {
                authenticate()
                post("/chat/completions") {
                    // 处理请求并调用 UnifiedInferenceService
                }
                get("/models") {
                    // 返回可用模型列表
                }
            }
        }
    }
    
    private fun Route.authenticate() {
        handle {
            // 如果 API Key 为空，跳过验证
            if (apiKey.isNullOrEmpty()) {
                proceed()
                return@handle
            }
            
            // 验证 Bearer Token
            val authHeader = call.request.header("Authorization")
            if (authHeader != "Bearer $apiKey") {
                call.respond(HttpStatusCode.Unauthorized, "Invalid API Key")
                return@handle
            }
            proceed()
        }
    }
    
    fun start() = server.start(wait = false)
    fun stop() = server.stop(1, 1, TimeUnit.SECONDS)
    fun isRunning() = server.isStarted
}
```

---

## ⚠️ 错误提示文案

| 错误类型 | 用户提示 |
|---------|---------|
| 端口被占用 | "端口 {port} 已被占用，是否尝试使用端口 {newPort}？" |
| 权限不足 | "无权限使用端口 {port}，请尝试使用 1024 以上的端口" |
| 服务已运行 | "API 服务已在运行，端口：{port}" |
| 网络错误 | "无法绑定到指定地址，请检查网络配置" |
| 资源不足 | "系统资源不足，无法启动 API 服务，请释放内存后重试" |
| 认证失败 | "无效的 API Key，请检查配置" |

---

## 📝 待办清单

| 序号 | 任务 | 状态 |
|------|------|------|
| 1 | 添加 Ktor 依赖到 build.gradle.kts | 待处理 |
| 2 | 创建 PortUtils.kt 端口检测工具类 | 待处理 |
| 3 | 创建 ApiServer.kt HTTP 服务器（含认证中间件） | 待处理 |
| 4 | 创建 ApiService.kt 服务管理类（含 API Key 支持） | 待处理 |
| 5 | 创建 ApiSettingsViewModel.kt（管理状态、生成随机 Key） | 待处理 |
| 6 | 修改 SettingsScreen.kt 添加 API 设置界面 | 待处理 |
| 7 | 添加字符串资源到 strings.xml | 待处理 |
| 8 | 实现端口冲突检测和自动重试 | 待处理 |
| 9 | 实现 API Key 输入、生成、清空功能 | 待处理 |
| 10 | 实现错误提示文案 | 待处理 |
| 11 | 添加测试 API 连通性功能 | 待处理 |
| 12 | 测试局域网访问功能 | 待处理 |
| 13 | 测试 API Key 认证功能 | 待处理 |
| 14 | 测试与 OpenClaw 客户端对接 | 待处理 |

---

## 📊 依赖需求

| 依赖 | 版本 | 说明 |
|------|------|------|
| io.ktor:ktor-server-core-jvm | 2.3.x | HTTP 服务器核心 |
| io.ktor:ktor-server-netty-jvm | 2.3.x | Netty 引擎 |
| io.ktor:ktor-server-content-negotiation-jvm | 2.3.x | 内容协商 |
| io.ktor:ktor-serialization-gson-jvm | 2.3.x | JSON 序列化 |

---

## 📅 预计时间

| 阶段 | 任务 | 预计时间 |
|------|------|---------|
| 第一阶段 | 基础实现（依赖、工具类、服务器） | 1 天 |
| 第二阶段 | UI 集成（界面、ViewModel、状态管理） | 0.5 天 |
| 第三阶段 | API Key 功能（输入、生成、认证） | 0.5 天 |
| 第四阶段 | 测试优化（端口检测、错误处理、对接测试） | 0.5 天 |
| **总计** | | **2.5 天** |

---

## 📱 UI 设计参考

```
┌─────────────────────────────────────┐
│          API 服务设置               │
├─────────────────────────────────────┤
│ ☑️ 启用 Ollama API 服务              │
│                                    │
│ 地址: http://192.168.1.100:11434   │
│ [编辑]                             │
│                                    │
│ API Key: [________________________] │
│ [生成随机 Key] [清空]               │
│ 提示：留空则不验证 API Key           │
│                                    │
│ ☑️ 允许局域网访问                   │
│                                    │
│ ┌─────────────────────────────┐    │
│ │        测试 API 连通性       │    │
│ └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

---

*Created: 2026-04-28 | Last Updated: 2026-04-28*
