import { Card, Typography } from 'antd'

const { Title } = Typography

export default function PipelinePage() {
  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        研发进展泳道图
      </Title>
      <Card>
        <div style={{ color: '#999', textAlign: 'center', padding: '80px 0' }}>
          泳道图组件待实现
        </div>
      </Card>
    </div>
  )
}
