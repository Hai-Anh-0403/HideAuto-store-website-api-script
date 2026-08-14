import { useNavigate } from 'react-router-dom'
import { Card, CardHead } from '../ui/Card'
import { Pill } from '../ui/Pill'
import { keyStatus } from '../lib/pills'
import { useAppData } from '../store/AppData'

export function Keys() {
  const { scripts } = useAppData()
  const nav = useNavigate()
  const rows = scripts.flatMap((s) => s.keys.map((k) => ({ ...k, app: s.name })))

  return (
    <>
      <div className="vhead">
        <div>
          <h2>Khóa kích hoạt</h2>
          <p>
            Mỗi khóa mở <b>đúng 1 mini app</b> — tạo khóa ngay trong trang mini app để khỏi nhầm.
          </p>
        </div>
        <span className="ep">
          <b>GET</b> /sellers/me/keys
        </span>
      </div>

      <Card>
        <CardHead
          title="Tất cả khóa"
          actions={
            <button className="btn pri sm" onClick={() => nav('/mini-apps')}>
              → Vào mini app để tạo khóa
            </button>
          }
        />
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>Khóa</th>
                <th>Mini app</th>
                <th>Nhãn</th>
                <th>Trạng thái</th>
                <th>Đã dùng</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((r) => {
                  const ks = keyStatus[r.status]
                  return (
                    <tr key={r.k}>
                      <td>
                        <span className="keychip">{r.k}</span>
                      </td>
                      <td>
                        <Pill tone="accent">{r.app}</Pill>
                      </td>
                      <td>{r.label || '—'}</td>
                      <td>
                        <Pill tone={ks.tone}>{ks.label}</Pill>
                      </td>
                      <td className="tnum">
                        {r.used} / {r.max == null ? '∞' : r.max}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={5} className="u-sub" style={{ padding: '18px 16px' }}>
                    Chưa có khóa. Vào từng mini app để tạo khóa.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="card-foot">
          <span className="note">
            User nhập khóa → mở đúng mini app tương ứng.{' '}
            <span className="mono">POST /sellers/me/scripts/{'{id}'}/keys</span>
          </span>
        </div>
      </Card>
    </>
  )
}
