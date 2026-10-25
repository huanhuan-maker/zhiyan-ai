import store from '@/store'

// A real HTTP MCP client, isolated from the legacy REST response envelope.
export function createSurveyMcpClient() {
  let version = null, serial = 0
  const controller = new AbortController()
  async function post(method, params, notification = false) {
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', token: store.state.user.token }
    if (version) headers['MCP-Protocol-Version'] = version
    const body = { jsonrpc: '2.0', method, ...(params ? { params } : {}), ...(!notification ? { id: ++serial } : {}) }
    const response = await fetch(process.env.VUE_APP_API_ROOT + '/assistant-mcp', { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal })
    if (notification && response.status === 202) return null
    const result = await response.json()
    if (!response.ok || result.error) throw new Error(result.error?.message || result.error || '查询工具连接失败，请重新登录或重试')
    if (result.jsonrpc !== '2.0' || result.id !== body.id || !result.result) throw new Error('查询工具返回了不匹配的响应')
    return result.result
  }
  return {
    async connect() {
      const info = await post('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'zhiyan-survey-assistant', version: '1.0.0' } })
      if (info.protocolVersion !== '2025-06-18') throw new Error('查询工具协议版本不兼容')
      version = info.protocolVersion
      await post('notifications/initialized', {}, true)
      const listed = await post('tools/list', {})
      const required = ['search_surveys', 'survey_stats', 'search_answers', 'survey_report']
      if (!required.every(name => listed.tools?.some(t => t.name === name && t.annotations?.readOnlyHint))) throw new Error('只读查询工具不完整')
      return listed.tools
    },
    async call(name, args, turnId) {
      if (!version) throw new Error('请先连接查询工具')
      const result = await post('tools/call', { name, arguments: args, ...(turnId ? { _meta: { assistantTurnId: turnId } } : {}) })
      if (result.isError) throw new Error(result.content?.find(c => c.type === 'text')?.text || '查询失败')
      return result.structuredContent || JSON.parse(result.content.find(c => c.type === 'text').text)
    },
    close() { controller.abort() }
  }
}
