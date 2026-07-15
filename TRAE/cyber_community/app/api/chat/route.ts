import { NextRequest, NextResponse } from 'next/server'

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY ?? ''
const DASHSCOPE_BASE = 'https://dashscope.aliyuncs.com/compatible-mode/v1'

const SYSTEM_PROMPT = `你是智慧社区的AI助手，负责分析居民反馈的小区问题并生成结构化报告。

## 核心规则（必须严格遵守）

**无论用户上传图片还是只提交文字描述，你都需要判断是否存在小区设施相关问题，并统一按下方格式回复。**

小区设施问题包括但不限于：
- 公共设施损坏：路灯不亮、电梯故障、门禁损坏、水管漏水、墙面开裂、地砖破损、围栏倒塌等
- 安全隐患：电线裸露、消防通道堵塞、灭火器过期/缺失、高空坠物风险、燃气泄漏痕迹等
- 环境卫生：垃圾堆积、污水横流、楼道堆物、墙面涂鸦、绿化枯死等
- 违规现象：车辆乱停、私搭乱建、占用公共区域等

## 回复格式

### 如果识别出小区设施问题：
以"识别到以下小区设施问题："开头，然后按以下结构回复：
1. 直接给出10字以内的标题，用中文方括号包裹（示例："【2栋电梯按键失灵】"）
2. 问题描述：用专业、清晰的语言描述问题（如果是文字描述，请润色优化用户的原文）
3. 问题位置/范围：（如果用户提到了位置）
4. 紧急程度：🔴高紧急 / 🟡中紧急 / 🟢低紧急
5. 建议处理方式

### 纯文字场景特别说明：
- 当用户仅提供文字描述（无图片）时，请对描述进行润色优化，使其更专业、清晰
- 同时归纳出10字以内的标题
- 按上述格式回复

### 如果未识别出任何小区设施问题：
请**只回复**以下内容，不要添加任何其他文字：
"未识别到任何问题。请您从不同角度重新拍摄更清晰的照片，或直接输入文字描述遇到的具体情况，我会为您记录并上报。"

## 注意事项
- 不要对风景照、人物照、宠物照、食物照等非小区设施图片强行识别问题
- 对于与小区设施完全无关的文字描述（如闲聊、天气等），返回"未识别到任何问题"
- 语气专业、客观
- 用中文回复`

interface ChatRequestBody {
  message: string
  imageBase64?: string | null
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequestBody = await request.json()
    const { message, imageBase64 } = body

    if (!message?.trim() && !imageBase64) {
      return NextResponse.json(
        { error: '请输入问题描述或上传图片' },
        { status: 400 },
      )
    }

    if (!DASHSCOPE_API_KEY) {
      const reply = generateLocalReply(message, !!imageBase64)
      const { identified, title, summary, severity } = parseRecognitionResult(reply, !!imageBase64)
      return NextResponse.json({ success: true, reply, identified, title, summary, severity })
    }

    // 构建消息内容（支持多模态）
    const userContent: Array<Record<string, unknown>> = []

    if (imageBase64) {
      // 确保 base64 有正确的 data URI 前缀
      const dataUri = imageBase64.startsWith('data:')
        ? imageBase64
        : `data:image/jpeg;base64,${imageBase64}`

      userContent.push({
        type: 'image_url',
        image_url: { url: dataUri },
      })
    }

    if (message?.trim()) {
      const text = imageBase64
        ? `请判断这张图片是否存在小区设施问题。如果存在，请描述具体问题；如果不存在，请只回复"未识别到任何问题。请您从不同角度重新拍摄更清晰的照片，或直接输入文字描述遇到的具体情况，我会为您记录并上报。"。补充说明：${message.trim()}`
        : `请对以下居民反馈的文字描述进行分析：${message.trim()}

如果描述的是小区设施相关问题，请对原文进行润色优化，归纳10字以内标题，按标准格式回复（识别到以下小区设施问题：...）。
如果描述的与小区设施完全无关，只回复"未识别到任何问题。请您从不同角度重新拍摄更清晰的照片，或直接输入文字描述遇到的具体情况，我会为您记录并上报。"。`
      userContent.push({ type: 'text', text })
    } else if (imageBase64) {
      userContent.push({
        type: 'text',
        text: '请判断这张图片是否存在小区设施问题（如公共设施损坏、安全隐患、环境卫生、违规停车等）。如果存在，请描述具体问题；如果不存在任何问题，请只回复"未识别到任何问题。请您从不同角度重新拍摄更清晰的照片，或直接输入文字描述遇到的具体情况，我会为您记录并上报。"。',
      })
    }

    const response = await fetch(`${DASHSCOPE_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'qwen-vl-max',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('DashScope API 错误:', response.status, errText)
      return NextResponse.json({
        success: true,
        reply: generateLocalReply(message, !!imageBase64),
        identified: false,
        title: null,
        summary: null,
      })
    }

    const data = await response.json()
    const reply =
      data?.choices?.[0]?.message?.content ||
      generateLocalReply(message, !!imageBase64)

    // 解析识别结果
    const { identified, title, summary, severity } = parseRecognitionResult(reply, !!imageBase64)

    return NextResponse.json({ success: true, reply, identified, title, summary, severity })
  } catch (error) {
    console.error('Chat API 异常:', error)
    return NextResponse.json({
      success: true,
      reply: generateLocalReply(
        (await getBodySafely(request))?.message ?? '',
        false,
      ),
      identified: false,
      title: null,
      summary: null,
      severity: null,
    })
  }
}

/** 解析 AI 回复，提取识别结果、标题、摘要和紧急程度 */
function parseRecognitionResult(reply: string, _hasImage: boolean): {
  identified: boolean
  title: string | null
  summary: string | null
  severity: string | null
} {
  // 判断是否识别出问题（图片和文字场景统一使用此格式）
  const identifiedPrefix = '识别到以下小区设施问题：'
  if (reply.startsWith(identifiedPrefix)) {
    const body = reply.slice(identifiedPrefix.length).trim()
    const lines = body.split('\n')

    // 提取标题：匹配第 1 行中的 【xxx】 格式
    let title: string | null = null
    for (const line of lines) {
      const bracketMatch = line.match(/【(.+?)】/)
      if (bracketMatch && bracketMatch[1].trim()) {
        title = bracketMatch[1].trim().slice(0, 10)
        break
      }
    }

    // 提取问题描述作为摘要
    const descLine = lines.find(l => l.match(/^\d+\.\s*问题描述/))
    let summary = descLine
      ? descLine.replace(/^\d+\.\s*问题描述[：:]\s*/, '').trim()
      : lines.find(l => l.trim() && !l.includes('【') && l.length > 3)?.trim() ?? '设施问题'

    if (summary.length > 50) {
      summary = summary.slice(0, 47) + '...'
    }

    // 提取紧急程度：🔴高紧急 → high, 🟡中紧急 → mid, 🟢低紧急 → low
    let severity: string | null = null
    for (const line of lines) {
      if (line.includes('🔴高紧急')) { severity = 'high'; break }
      if (line.includes('🟡中紧急')) { severity = 'mid'; break }
      if (line.includes('🟢低紧急')) { severity = 'low'; break }
    }

    return { identified: true, title, summary, severity }
  }

  return { identified: false, title: null, summary: null, severity: null }
}

/** 安全获取请求体（catch 中使用） */
async function getBodySafely(request: NextRequest) {
  try {
    const cloned = request.clone()
    return await cloned.json()
  } catch {
    return null
  }
}

/** 本地兜底回复（API 不可用时使用） */
function generateLocalReply(message: string, hasImage: boolean): string {
  if (hasImage) {
    return `📷 已收到您上传的图片${message ? `和描述"${message}"` : ''}。

暂无法自动识别图片内容（AI视觉服务未配置）。请您描述图片中的问题（如设施损坏、安全隐患、环境卫生等），工作人员会尽快处理。`
  }

  if (message.includes('报修') || message.includes('维修') || message.includes('坏了') || message.includes('破损') || message.includes('漏水') || message.includes('故障')) {
    const title = message.length > 10 ? message.slice(0, 10) : message
    return `识别到以下小区设施问题：
1. 【${title}】
2. 问题描述：${message}
3. 问题位置/范围：待确认
4. 紧急程度：🟡中紧急
5. 建议处理方式：请工作人员前往现场查看并处理。`
  }

  return `收到您的问题！我已为您记录并上报给居委会处理。

💡 提示：如果您遇到的是设施损坏、环境卫生等问题，可以上传现场照片，我会帮您自动识别并分类问题类型与紧急程度。

我们会尽快安排工作人员联系您。如有紧急情况，请直接拨打物业电话。`
}
