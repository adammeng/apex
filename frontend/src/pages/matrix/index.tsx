import { Card, Typography } from 'antd'

const { Title } = Typography

export default function MatrixPage() {
  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        靶点竞争矩阵
      </Title>
      <Card>
        <div style={{ color: '#999', textAlign: 'center', padding: '80px 0' }}>
          竞争矩阵组件待实现
        </div>
      </Card>
    </div>
  )
}
