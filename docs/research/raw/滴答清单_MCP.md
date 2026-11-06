# 滴答清单 MCP

> 原文: https://help.dida365.com/articles/7438132116019216384
> articleId: 69b3c45adf6b009a1adc9a31

# 什么是 MCP？
MCP（Model Context Protocol）是一种开放协议，允许支持 MCP 的 AI 客户端（如 Claude、ChatGPT、Cursor、VS Code 等）直接与外部服务进行交互。通俗来说，MCP 可以让 AI 直接帮你完成应用里的操作。

**通过接入滴答清单 MCP，AI 助手可以直接读取、创建和管理你的任务，成为你的专属“任务管家”。** 你无需切换应用，直接在 AI 对话框中完成任务管理即可。

例如，你可以直接对 AI 说：
- 我今天有哪些任务？
- 帮我创建一个任务：明天下午 3 点准备会议材料，高优先级。
- 把“买牛奶”这个任务标记为已完成。

**AI 将通过滴答清单 MCP 自动调用对应工具并完成操作。**

# 连接滴答清单 MCP

滴答清单 MCP 支持 Streamable HTTP 远程传输协议，支持 OAuth 和 Bearer Token 两种授权方式。可通过以下 URL 实现连接：

```
https://mcp.dida365.com
```

你可以在不同的 AI 工具中连接滴答清单 MCP，下面是常见 AI 客户端的配置方法。

::: spoiler Bearer Token 如何获取？
如需Bearer Token，可前往网页版滴答清单，点击「头像」- 「设置」 -「账户与安全」 - 「API 口令」中创建并复制使用。
:::

## WorkBuddy

> WorkBuddy 目前仅支持在桌面客户端配置自定义连接器，浏览器和移动端暂不支持。

1. 打开 WorkBuddy，在左侧菜单中选择**专家 · 技能 · 连接器**。

2. 在右侧页面顶部选择 **连接器**，点击右侧 **自定义连接器**。

3. 点击弹窗右上角 **配置MCP**。

请从以下授权方式中选择一种：**OAuth** 或 **Bearer Token**。

**OAuth**

4. 添加以下内容：

```
{
  "mcpServers": {
    "dida365": {
      "type": "http",
      "url": "https://mcp.dida365.com",
      "disabled": false
    }
  }
}
```

5. 保存配置后返回 MCP 列表，在已安装的 MCP 服务中找到滴答清单，点击右侧 **连接**，在浏览器中完成 OAuth 登录和授权。

**Bearer Token**

4. 添加以下内容，并将获取到的 Bearer Token 替换至 `headers` 字段中的 `YOUR_TOKEN_HERE` ：

```
{
  "mcpServers": {
    "dida365": {
      "type": "http",
      "url": "https://mcp.dida365.com",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN_HERE"
      },
      "disabled": false
    }
  }
}
```

## 豆包（豆包工作）

> 豆包目前仅支持在桌面客户端配置自定义连接器，浏览器和移动端暂不支持。

1. 打开豆包，在左侧菜单中选择 **连接器 · 技能 · 伙伴**。

2. 在页面右上角点击 **添加**，选择 **新建自定义连接器**。

3. 传输类型选择 HTTP，输入 MCP 服务器 URL：

```
https://mcp.dida365.com
```

4. 保存配置后，根据指引在浏览器中完成 OAuth 登录和授权。

==💡目前推荐使用 [DIDA CLI](https://help.dida365.com/articles/7464976698707017728)，使用更稳定。==

## 千问办公

> 千问办公目前仅支持在桌面客户端配置自定义连接器，浏览器暂不支持。

1. 打开千问办公，在左侧菜单中选择 **连接器**。

2. 在页面右上角点击 **添加**，两种方式选择任意一种。

请从以下授权方式中选择一种：**OAuth** 或 **Bearer Token**。

**OAuth**

3. 选择 **手动填写配置**。

	1. 服务器类型选择 **Streamable HTTP**，输入 MCP 服务器地址：`https://mcp.dida365.com`

	2. 保存配置后，根据指引在浏览器中完成 OAuth 登录和授权。

4. 选择 **粘贴 JSON 配置**，添加以下内容：

```
{
  "mcpServers": {
    "dida365": {
      "type": "streamable-http",
      "url": "https://mcp.dida365.com"
    }
  }
}
```

**Bearer Token**

3. 选择 **手动填写配置**。

	1. 服务器类型选择 **Streamable HTTP**，输入 MCP 服务器地址：`https://mcp.dida365.com`

	2. 点击 Headers 右侧的粘贴，添加以下内容，并将获取到的 Bearer Token 替换至 `YOUR_TOKEN_HERE`：`Authorization: Bearer YOUR_TOKEN_HERE`

	3. 点击解析后，保存配置即可。

4. 选择 **粘贴 JSON 配置**，添加以下内容，并将获取到的 Bearer Token 替换至 `YOUR_TOKEN_HERE`：

```
{
  "mcpServers": {
    "dida365": {
      "type": "streamable-http",
      "url": "https://mcp.dida365.com",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN_HERE"
      }
    }
  }
}
```

## 超级小爱

1. 打开 **系统设置**，依次进入 **小米澎湃 AI > 超级小爱**。

2. 点击 **MCP 服务**，然后点击右上角的 **+**。

3. 输入以下内容，然后点击 **添加**：

	- 名称：自定义服务名称，例如 `dida`
	- 服务器 URL：`https://mcp.dida365.com`
	- Auth Token：输入 `Bearer YOUR_TOKEN_HERE`，并将 `YOUR_TOKEN_HERE` 替换为已获取的 API 口令

4. 打开超级小爱并选择 **专家** 模式，即可发送指令，例如：“帮我在 dida 中创建一个测试任务。”

## ChatGPT（Codex）

1. 打开 ChatGPT，在侧边栏选择 **插件**。

2. 搜索 **滴答清单** 或 [点击前往](https://chatgpt.com/plugins/plugin_asdk_app_6a87b30329908191837da812ccda47b6)，点击右侧的+，再点击 **安装插件**。

3. 按照页面提示完成 OAuth 登录和授权。

## Claude

> Claude 的自定义连接器功能适用于 Free、Pro、Plus、Business 和 Enterprise 等套餐；免费用户只能使用一个自定义 MCP 服务器。

1. 打开 Claude，在侧边栏选择 **自定义**。

2. 点击右上角添加，选择 **添加自定义连接器**。

3. 输入 MCP 服务器 URL：

```
https://mcp.dida365.com
```

4. 创建后点击 **继续**，按照页面提示完成 OAuth 登录和授权。

## Gemini

1. 打开 Gemini，在左侧边栏选择 **自定义**。

2. 在页面顶部选择 **关联应用**。

3. 点击右侧的 **+ 自定义**。

4. 在自定义关联应用设置弹窗中，选择 **Cloud MCP**。

5. 在 **添加自定义应用链接** 中输入 MCP 服务器 URL：

```
https://mcp.dida365.com
```

6. 点击 **下一步**，然后按照页面提示完成 OAuth 登录和授权。

## Codex CLI

1. 在终端运行以下命令：

```
codex mcp add dida365 --url https://mcp.dida365.com
```

2. 命令执行后会自动提示完成 OAuth 登录和授权。

## Claude Code

请从以下授权方式中选择一种：**OAuth** 或 **Bearer Token**。

**OAuth**

1. 在终端中运行以下命令：

```
claude mcp add --transport http dida365 https://mcp.dida365.com
```

2. 在 Claude Code 会话中运行 `/mcp` ，按照提示完成 OAuth 授权流程。

**Bearer Token**

1. 在终端中运行以下命令，并将获取到的 Bearer Token 替换至 `YOUR_TOKEN_HERE`：

```
claude mcp add --transport http dida365 https://mcp.dida365.com --header "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Cursor

1. 打开 Cursor，进入 **Cursor Settings**。

2. 在左侧菜单中选择 **Tools & MCP**，点击 **Add Custom MCP**。

请从以下授权方式中选择一种：**OAuth** 或 **Bearer Token**。

**OAuth**

3. 编辑 `.cursor/mcp.json` 配置文件，添加以下内容：

```
{
  "mcpServers": {
    "dida365": {
      "url": "https://mcp.dida365.com"
    }
  }
}
```

4. 保存配置后，重新打开 **Tools & MCP**，在已安装的 MCP 服务中找到滴答清单，点击右侧 **connect**，在浏览器中完成 OAuth 登录和授权。

**Bearer Token**

3. 编辑 `.cursor/mcp.json` 配置文件，添加以下内容，并将获取到的 Bearer Token 替换至 `YOUR_TOKEN_HERE`：

```
{
  "mcpServers": {
    "dida365": {
      "url": "https://mcp.dida365.com",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN_HERE"
      }
    }
  }
}
```

## VS Code

请从以下授权方式中选择一种：**OAuth** 或 **Bearer Token**。

**OAuth**

1. 在工作区中创建或编辑 `.vscode/mcp.json` 文件，添加以下内容：

```
{
 "servers": {
    "dida365": {
      "type": "http",
      "url": "https://mcp.dida365.com"
    }
  }
}
```

2. 也可以通过命令面板（Ctrl+Shift+P / Cmd+Shift+P）运行 **Add Server**，选择 **HTTP (HTTP or Server-Sent Events)**，输入 MCP 服务器 URL  `https://mcp.dida365.com` 以及 ID，选择作用范围为工作区或全局。

3. 保存配置后，根据指引在浏览器中完成 OAuth 登录和授权。

**Bearer Token**

1. 在工作区中创建或编辑 `.vscode/mcp.json` 文件，添加以下内容，并将获取到的 Bearer Token 替换至 `YOUR_TOKEN_HERE`：

```
{
  "servers": {
    "dida365": {
      "type": "http",
      "url": "https://mcp.dida365.com",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN_HERE"
      }
    }
  }
}
```

## TRAE

1. 打开 TRAE，进入设置。

2. 在左侧菜单中选择 **MCP**，点击 **添加 > 手动添加**。

请从以下授权方式中选择一种：**OAuth** 或 **Bearer Token**。

**OAuth**

3. 添加以下内容：

```
{
  "mcpServers": {
    "dida365": {
      "url": "https://mcp.dida365.com"
    }
  }
}
```

4. 保存配置后，在已安装的 MCP Servers 中找到滴答清单，点击右侧**前往验证**，在浏览器中完成 OAuth 登录和授权。

**Bearer Token**

3. 添加以下内容，并将获取到的 Bearer Token 替换至 `YOUR_TOKEN_HERE`：

```
{
  "mcpServers": {
    "dida365": {
      "url": "https://mcp.dida365.com",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN_HERE"
      }
    }
  }
}
```

## Antigravity

1. 打开 Antigravity，进入设置。

2. 在左侧菜单中选择 **Customizations**，在 Installed MCP Servers 点击 **Open MCP Config** 并打开 `mcp_config.json`。

3. 添加以下内容，并将获取到的 Bearer Token 替换至 `YOUR_TOKEN_HERE`：

```
{
    "mcpServers": {
      "dida365": {
        "serverUrl": "https://mcp.dida365.com",
        "headers": {
          "Authorization": "Bearer YOUR_TOKEN_HERE"
        }
      }
    }
}
```

4. 保存配置后，点击刷新即可。

# 可用工具

当你在 AI 对话中提出任务相关的需求时，AI 会自动调用滴答清单 MCP 提供的工具来完成操作。这些工具就像一组“能力”，让 AI 可以查询任务、创建任务或更新任务状态。

> 💡 通常你不需要记住这些工具名称。只需用自然语言描述你的需求，AI 会自动选择合适的工具来执行。

以下是滴答清单 MCP 提供的工具：

## 查询任务

| 工具                              | 介绍                            | 说明                                                               |
| ------------------------------- | ----------------------------- | ---------------------------------------------------------------- |
| search_task                     | 使用关键词搜索任务，返回任务 ID、标题和链接等 |                         |
| get_task_by_id                  | 根据任务 ID 获取任务的完整内容 |                     |
| list_undone_tasks_by_time_query | 查询一段时间的未完成任务，默认查询今天的未完成任务 | 支持选项：today, last24hour, last7day, tomorrow, next24hour, next7day |
| list_undone_tasks_by_date       | 查询指定日期范围内的未完成任务 | 日期跨度最大 14 天 |
| list_completed_tasks_by_date    | 查询指定清单中，在日期范围内的已完成的任务         | |
| filter_tasks                    | 按日期、清单、优先级、标签、类型、状态等多条件组合查询任务 | |

## 清单管理

| 分类  | 工具                            | 介绍                           | 说明  |
| --- | ----------------------------- | ---------------------------- | --- |
| 清单  | list_projects                 | 获取当前账号中的所有清单                 |     |
|     | create_project                | 创建新清单                        |     |
|     | update_project                | 修改清单的设置                      |     |
|     | get_project_by_id             | 根据清单 ID 获取指定清单的详细信息          |     |
|     | get_project_with_undone_tasks | 获取指定清单的详细信息，同时返回该清单下所有未完成的任务 |     |
|     | get_task_in_project           | 获取指定清单中的某个特定任务               |     |
| 分组  | list_columns                  | 获取指定清单下的所有分组                 |     |
|     | create_column                 | 在指定清单下创建新分组                  |     |
|     | update_column                 | 在指定清单下修改分组名称                 |     |
| 文件夹 | list_project_groups           | 获取所有的文件夹                     |     |
|     | create_project_group          | 创建新的文件夹                      |     |
|     | update_project_group          | 修改文件夹名称                      |     |
|     | delete_project_group          | 解散文件夹下的所有清单                  |     |

## 任务管理

| 分类  | 工具                        | 介绍                             | 说明        |
| --- | ------------------------- | ------------------------------ | --------- |
| 任务  | create_task               | 创建任务，支持设置标题、描述、日期、优先级、清单、标签等属性 |           |
|     | batch_add_tasks           | 批量创建任务，并设置每个任务的各字段             |           |
|     | complete_task             | 完成指定任务                         |           |
|     | complete_checklist_item    | 完成清单任务中的指定清单项                  |           |
|     | complete_tasks_in_project | 批量完成指定清单中的多个任务                 | 每次最多 20 个 |
|     | update_task               | 修改任务的标题、描述、日期、优先级等属性           |           |
|     | move_task                 | 将任务移动到其他清单                     |           |
|     | batch_update_tasks        | 批量修改多个任务的属性                    |           |
|     | delete_task               | 将任务移动到垃圾箱                      |           |
| 评论  | get_comment               | 获取指定任务下的所有评论                   |           |
|     | add_comment               | 在指定任务下新增评论                     |           |
|     | delete_comment            | 删除指定评论                         |           |
| 指派  | assign_task               | 指派任务给其他成员                      |           |
|     | unassign_task             | 取消任务指派                         |           |
|     | list_project_members      | 列出指定共享清单下的所有成员                 |           |
| 标签  | list_tags                 | 列出所有标签                         |           |
|     | create_tag                | 创建新标签                          |           |
|     | rename_tag                | 修改标签名称                          |           |
|     | update_tag                | 修改标签颜色、其他属性                          |           |
|     | delete_tag                | 删除指定标签，并从所有任务中移除此标签                          |           |

## 习惯管理

| 工具                    | 介绍             | 说明            |
| --------------------- | -------------- | ------------- |
| list_habits           | 获取当前账号中的所有习惯   |               |
| list_habit_sections   | 获取当前所有的习惯分组    |               |
| create_habit          | 创建新习惯          |               |
| update_habit          | 修改习惯的设置        |               |
| get_habit             | 获取指定习惯的详细信息    |               |
| get_habit_checkins    | 获取指定习惯的打卡记录    |               |
| upsert_habit_checkins | 创建或更新某个习惯的打卡记录 | 打卡范围支持最近 90 天 |

## 专注记录管理

| 工具                  | 介绍        | 说明               |
| ------------------- | --------- | ---------------- |
| get_focuses_by_time | 按时间查询专注记录 | 一次最多支持查询一个月的专注记录 |
| get_focus           | 获取指定专注记录  |                  |
| create_focus        | 添加专注记录    |                  |
| update_focus       | 修改专注记录     | 专注时间不可修改      |
| delete_focus        | 删除指定专注记录  |                  |

## 查询订阅日历

| 工具                     | 介绍                    | 说明                              |
| ---------------------- | --------------------- | ------------------------------- |
| list_calendar_accounts | 获取已关联到滴答清单的第三方日历账号 |                                   |
| query_calendar_events  | 查询已关联第三方日历中的日程        | 默认查询当前至未来三个月；自定义日期范围最长 3 个月 |

## 查询纪念日

| 工具              | 介绍      | 说明  |
| --------------- | ------- | --- |
| list_countdowns | 获取所有纪念日 |     |

# 如何使用

连接完成后，你可以直接用自然语言向 AI 发起请求。AI 会根据你的指令自动调用滴答清单 MCP 的功能来查询、创建或更新任务。

下面是一些示例指令，帮助你了解可以如何与 AI 交互。

## 任务的查询与回顾

例如：

>  “我今天有哪些任务？”

> “帮我列出这周所有高优先级任务。”

> “上周我完成了哪些任务？”

> “我的备考复习清单中还有哪些未完成任务？”

AI 会根据你的请求返回对应的任务信息，方便你查看安排或进行复盘。



## 任务的创建与管理

例如：

> “创建一个任务：今天下午 3 点完成汇报 PPT，高优先级。”

> “今天去买绿植，周末去公园看花，下周二庆祝朋友生日，帮我把这些都创建成任务放到‘热爱生活’清单。”

> “把生活清单里的‘买牛奶’和‘买日用品’标记为完成。”

> “帮我把‘去露营’移动到‘户外活动’清单。”

AI 会自动识别任务内容，并提取相关信息、完成对应操作，例如创建任务、更新状态或整理清单。

# 常见问题

::: spoiler 我的客户端不支持 Streamable HTTP，能连接吗？
目前滴答清单 MCP 仅支持 Streamable HTTP 协议，不支持 SSE。如果你的客户端只支持 SSE，暂时无法直接连接。
:::

::: spoiler 操作没有按预期执行，比如任务没有被找到，或者创建/更新操作失败？
可能有几种原因：AI 模型对你的描述理解有偏差、选择了不匹配的工具，或传递的参数不正确。可尝试以下方式：
- 使用更明确的描述，例如指定任务所在的清单名称、具体日期或优先级
- 将复杂请求拆分为多步，例如先让 AI 查找任务，确认找到后再执行操作
:::

::: spoiler 是否支持所有滴答清单中的功能？
目前主要支持任务、清单、习惯、专注记录以及纪念日的基础操作，其他高级功能暂未支持。
:::

::: spoiler 每次重启 AI 客户端后需要重新登录吗？
不需要。OAuth 授权支持 Token 自动刷新，正常情况下无需重复登录。如果长时间未使用或主动撤销授权，才需要重新完成授权流程。
:::
