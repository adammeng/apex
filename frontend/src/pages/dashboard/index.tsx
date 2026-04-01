import { Card, Col, Row, Statistic, Typography } from 'antd'
import {
  ExperimentOutlined,
  MedicineBoxOutlined,
  FileSearchOutlined,
  SyncOutlined,
} from '@ant-design/icons'

const { Title } = Typography

export default function DashboardPage() {
  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        数据总览
      </Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="药物总数"
              value="—"
              prefix={<MedicineBoxOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="临床试验数"
              value="—"
              prefix={<ExperimentOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="活跃管线数"
              value="—"
              prefix={<FileSearchOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="数据更新"
              value="—"
              prefix={<SyncOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="研发阶段分布" style={{ minHeight: 280 }}>
            <div style={{ color: '#999', textAlign: 'center', paddingTop: 80 }}>
              图表组件待实现
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="治疗领域分布" style={{ minHeight: 280 }}>
            <div style={{ color: '#999', textAlign: 'center', paddingTop: 80 }}>
              图表组件待实现
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
