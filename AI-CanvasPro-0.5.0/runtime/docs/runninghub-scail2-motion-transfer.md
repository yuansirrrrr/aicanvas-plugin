# RunningHub Scail2 动作迁移实现流程

本文记录项目中 Scail2 动作迁移的实现方式、调用接口、工作流 ID、节点映射，以及替换为个人 RunningHub 工作流时需要注意的事项。

## 结论

项目里的 Scail2 动作迁移不是本地模型推理，也不是本地 ComfyUI 直接执行。

它的实际生成逻辑由 RunningHub 云端 AI App 工作流完成。本地项目只负责：

- 收集源视频、参考图和参数。
- 上传或复用媒体 URL。
- 根据 manifest 组装 RunningHub 需要的 `nodeInfoList`。
- 通过本地后端代理提交 RunningHub 任务。
- 拿到 `taskId` 后轮询 RunningHub query 接口。
- 将生成结果视频保存并展示到画布节点中。

## 相关文件

Scail2 相关配置主要在：

```text
src/manifests/video/runninghub/runningHubVideoScail2V1Manifest.js
```

视频生成请求入口：

```text
api/aiVideoApi.js
```

RunningHub 工作流请求适配器：

```text
api/adapters/RunningHubAdapter.js
```

本地后端代理：

```text
server.py
```

前端视频节点固定输入槽位组装：

```text
src/components/video-node/runningHubVideoSubmitPayload.js
```

## 工作流 ID

项目中 Scail 相关的 RunningHub 工作流 ID 有两个：

| 功能 | modelId | executionId | workflowId |
| --- | --- | --- | --- |
| Scail V1 | `runninghub/2064961300823896065` | `runninghub.workflow.video-scail2-v1.v1` | `2064961300823896065` |
| Scail V2 | `runninghub/2065463417577762818` | `runninghub.workflow.video-scail-v2.v1` | `2065463417577762818` |

当前项目里 Scail V2 的核心配置是：

```js
export const RH_VIDEO_SCAIL_V2_MODEL_ID = 'runninghub/2065463417577762818';
export const RH_VIDEO_SCAIL_V2_EXECUTION_ID = 'runninghub.workflow.video-scail-v2.v1';

export const rhVideoScailV2ExecutionManifest = createScailVideoExecutionManifest({
  id: RH_VIDEO_SCAIL_V2_EXECUTION_ID,
  label: '视频编辑 Scail V2',
  workflowId: '2065463417577762818',
  nodeInfoList: RH_VIDEO_SCAIL_V2_NODE_INFO_LIST,
});
```

## 整体调用流程

### 1. 用户选择 Scail V2 模型

用户在视频生成节点里选择 Scail V2 后，节点数据里的模型值会变成：

```text
runninghub/2065463417577762818
```

项目通过模型注册表找到对应的执行配置：

```text
runninghub.workflow.video-scail-v2.v1
```

这个执行配置会进一步指向 RunningHub AI App 工作流：

```text
2065463417577762818
```

### 2. 前端收集固定输入

Scail2 需要两个固定输入：

| 槽位 | 类型 | 作用 |
| --- | --- | --- |
| `sourceVideo` | video | 源视频，提供动作、姿态、运动轨迹 |
| `refImage` | image | 参考图，提供人物或主体外观 |

可以简单理解为：

```text
源视频 = 动作来源
参考图 = 人物/主体参考
```

如果用户明确输入了参考图，最终会进入 `inputUrls`，再由 manifest 映射到 RunningHub 的图片节点。

### 3. 构建 Scail V2 的 nodeInfoList

Scail V2 当前使用的节点映射如下：

| nodeId | fieldName | 来源 | 含义 |
| --- | --- | --- | --- |
| `336` | `video` | `sourceVideo` | 上传视频，动作来源 |
| `338` | `image` | `refImage` | 上传图像，主体参考 |
| `444` | `value` | 参数 | 是否替换主体 |
| `324` | `value` | 参数 | 分辨率，默认 `1024` |
| `383` | `value` | 参数 | 检测人数，默认 `2` |
| `318` | `value` | 参数 | 检测识别提示词，默认 `person` |
| `317` | `value` | 常量 | 提示词，目前为空字符串 |
| `336` | `force_rate` | 参数 | 帧率，默认 `24` |
| `336` | `frame_load_cap` | 参数 | 生成帧数，默认 `300` |
| `458` | `value` | 参数 | 强化动作控制，Scail V2 专有 |

实际提交时会变成类似这样的结构：

```json
[
  {
    "nodeId": "336",
    "fieldName": "video",
    "fieldValue": "https://.../source.mp4",
    "description": "上传视频"
  },
  {
    "nodeId": "338",
    "fieldName": "image",
    "fieldValue": "https://.../reference.png",
    "description": "上传图片"
  },
  {
    "nodeId": "444",
    "fieldName": "value",
    "fieldValue": "false",
    "description": "替换人物/动作参考"
  }
]
```

完整 `nodeInfoList` 由 `RunningHubAdapter` 根据 manifest 自动构建。

### 4. 提交 RunningHub AI App 任务

Scail V2 最终调用的 RunningHub 提交接口是：

```text
POST https://www.runninghub.cn/openapi/v2/run/ai-app/2065463417577762818
```

但前端不会直接请求 RunningHub，而是先请求本地后端代理：

```text
POST /api/v2/proxy/image
```

本地代理收到的请求体大致是：

```json
{
  "apiUrl": "https://www.runninghub.cn/openapi/v2/run/ai-app/2065463417577762818",
  "apiKey": "你的 RunningHub API Key",
  "nodeInfoList": [],
  "instanceType": "default",
  "usePersonalQueue": "false"
}
```

`server.py` 会取出 `apiUrl` 和 `apiKey`，再把其余 JSON 转发给 RunningHub，并在请求头里加：

```text
Authorization: Bearer <apiKey>
Content-Type: application/json
```

### 5. RunningHub 返回 taskId

提交成功后，RunningHub 通常返回：

```json
{
  "taskId": "2069591139299844097",
  "status": "RUNNING",
  "errorCode": "",
  "errorMessage": "",
  "results": null
}
```

这表示任务已经创建成功，仍在 RunningHub 云端执行。

这个状态是正常的，不代表失败。

### 6. 轮询 RunningHub query 接口

拿到 `taskId` 后，项目会继续轮询：

```text
POST https://www.runninghub.cn/openapi/v2/query
```

同样通过本地代理：

```text
POST /api/v2/proxy/image
```

轮询请求体类似：

```json
{
  "apiUrl": "https://www.runninghub.cn/openapi/v2/query",
  "apiKey": "你的 RunningHub API Key",
  "taskId": "2069591139299844097"
}
```

如果返回状态仍是：

```text
RUNNING
```

前端会继续等待并再次查询。

如果返回：

```text
COMPLETED
```

并且 `results` 中包含视频地址，项目会提取结果视频 URL，保存到本地输出目录，并在画布中展示。

## 日志怎么看

当前本地后端代理会在终端打印 RunningHub 工作流日志。

提交任务时会看到：

```text
[subscription][vip_gate] ... runninghub_workflow_gate_check
[runninghub][workflow] ... proxy_request
[runninghub][workflow] ... proxy_response
```

其中 `proxy_request` 里的重点字段：

| 字段 | 含义 |
| --- | --- |
| `apiUrl` | 实际要转发到 RunningHub 的接口 |
| `workflowId` | 当前 RunningHub AI App ID |
| `nodeCount` | 本次提交的节点入参数量 |
| `nodes` | 本次提交的节点摘要 |

如果 `proxy_response` 返回：

```json
{
  "taskId": "...",
  "status": "RUNNING"
}
```

说明任务已经成功进入 RunningHub 队列。

如果返回：

```text
NODE_INFO_MISMATCH
```

说明当前项目里的 `nodeInfoList` 和 RunningHub 工作流的真实节点不匹配。

## 使用个人 RunningHub 工作流时的注意事项

如果这些工作流 ID 是作者个人 RunningHub 账号里的 AI App，或者你想替换成自己的工作流，需要注意：

不能只替换 `workflowId`。

必须同时保证：

```text
workflowId = 你的 RunningHub AI App ID
nodeInfoList = 你的 AI App 真实节点入参
```

如果你在 ComfyUI 里重新搭了动作迁移工作流，并上传到 RunningHub，需要做这些事：

1. 在 RunningHub 发布自己的 AI App。
2. 获取自己的 AI App ID。
3. 将项目 manifest 里的 `workflowId` 改成你的 ID。
4. 在 RunningHub 查看或测试这个 AI App 的 demo 入参节点。
5. 把项目里的 `nodeId`、`fieldName`、默认值和参数名改成与你的工作流一致。
6. 重新运行项目测试。

典型错误：

```text
NODE_INFO_MISMATCH(nodeId=303, fieldName=video, reason=node_not_found_in_workflow)
```

含义是：

```text
项目提交了 nodeId=303 的 video 字段，但当前 workflowId 对应的 RunningHub 工作流里不存在这个节点。
```

解决方式不是改 API Key，而是同步工作流 ID 和节点映射。

## Scail2 动作迁移的数据流

```text
用户选择 Scail V2
  ↓
视频节点收集 sourceVideo 和 refImage
  ↓
根据 manifest 找到 modelId / executionId / workflowId
  ↓
上传或解析源视频、参考图 URL
  ↓
构建 RunningHub nodeInfoList
  ↓
POST /api/v2/proxy/image
  ↓
server.py 转发到 RunningHub run/ai-app 接口
  ↓
RunningHub 返回 taskId 和 RUNNING
  ↓
前端通过 query 接口轮询 taskId
  ↓
RunningHub 返回 COMPLETED 和结果视频 URL
  ↓
项目保存结果视频并显示到画布
```

## 核心判断

判断 Scail2 是否已经正确提交，优先看终端日志：

成功提交：

```text
apiUrl: https://www.runninghub.cn/openapi/v2/run/ai-app/2065463417577762818
status: RUNNING
taskId: 有值
```

节点不匹配：

```text
errorCode: 803
errorMessage: NODE_INFO_MISMATCH(...)
```

参考图没有传进去：

```text
nodes 里 nodeId=338 / fieldName=image 的 hasValue 不是 true
```

如果 `nodeId=338` 的 `image` 有值，说明项目已经把参考图提交给 RunningHub。后续参考图是否真正参与动作迁移，要看 RunningHub 工作流内部怎么使用这个节点。

