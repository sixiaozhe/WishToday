# DIDA CLI

> 原文: https://help.dida365.com/articles/7464976698707017728
> articleId: 6a156d5192c58e2739c3b194

安装 DIDA CLI，在终端中管理你的任务和项目，也可供 AI Agent 调用。

# 快速开始
## 安装
需要先安装 Node.js（建议 LTS 版本）。

```
# 安装
npm install -g @suibiji/dida-cli

# 验证安装成功
dida --help
dida --version
```

::: spoiler 如何在 OpenClaw、QClaw 等 AI Agent 中安装？
在 AI Agent 中，两步即可完成配置：

1.  **安装**

你可以直接在对话框中输入：
> 帮我安装 dida-cli：https://www.npmjs.com/package/@suibiji/dida-cli


2.  **授权**

安装成功后，在对话框中输入
> 授权登录

跟随引导完成授权登录后，即可通过 AI Agent 管理滴答清单中的任务和项目。
:::




## 登录认证

推荐通过浏览器 OAuth 登录。

```
# 浏览器 OAuth 授权登录（推荐）
dida auth login

# 确认登录状态
dida auth status

# 清除本地 token
dida auth logout
```

如果无法打开浏览器，可获取 Token 并手动配置：

```
# 直接写入 access token
dida auth token <YOUR_TOKEN_HERE>

# 确认登录状态
dida auth status

# 清除本地 token
dida auth logout
```

::: spoiler Token 如何获取？
前往网页版滴答清单，点击「头像」- 「设置」 -「账户与安全」 - 「API 口令」中创建并复制使用。
:::

# 常用命令
更多命令说明请参考 [npm 包文档](https://www.npmjs.com/package/@suibiji/dida-cli)。

```
dida project list                                       # 查看所有清单
dida task create --title "任务名称" --project <清单 ID>   # 创建任务
dida task complete <清单 ID> <任务 ID>                   # 完成任务
dida task delete <清单 ID> <任务 ID>                     # 删除任务
```

# 常见问题

::: spoiler 安装成功但命令无法运行？
npm 全局安装目录可能未加入 PATH。可运行` npm bin -g` 查看路径，并将其添加到 `.zshrc` 或 `.bashrc`。
:::

::: spoiler 是否支持所有滴答清单中的功能？
目前主要支持任务、清单、习惯、专注记录以及纪念日的基础操作，其他高级功能暂未支持。
:::
