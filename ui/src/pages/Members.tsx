import { Card, CardHead } from '../ui/Card'
import { Pill } from '../ui/Pill'
import { useAppData } from '../store/AppData'
import { useToast } from '../ui/Toast'
import type { Member } from '../types'

export function Members() {
  const { members, scripts, toggleMemberBlock } = useAppData()
  const { toast } = useToast()
  const total = scripts.length
  const appName = (id: string) => scripts.find((s) => s.id === id)?.name ?? id

  const onBlock = (i: number, m: Member) => {
    toggleMemberBlock(i)
    toast(m.status === 'blocked' ? `Đã bỏ chặn ${m.email}` : `Đã chặn ${m.email}`)
  }

  return (
    <>
      <div className="vhead">
        <div>
          <h2>Người dùng của tôi</h2>
          <p>
            Ai đã nhập khóa, <b>đang dùng mini app nào</b> của bạn (khóa nào → app đó).
          </p>
        </div>
        <span className="ep">
          <b>GET</b> /sellers/me/members
        </span>
      </div>

      <Card>
        <CardHead
          title={`${members.length} người dùng`}
          actions={
            <>
              <input className="search" placeholder="Tìm theo email…" />
              <button className="btn sm" style={{ marginLeft: 8 }} onClick={() => toast('Đã đồng bộ trạng thái từ flowdesk')}>
                ↻ Làm mới
              </button>
            </>
          }
        />
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>Người dùng</th>
                <th>Trạng thái</th>
                <th>Đang dùng</th>
                <th>Online</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => (
                <tr key={m.uid}>
                  <td>
                    <div className="u-main">{m.name}</div>
                    <div className="u-sub">
                      {m.email} · <span className="mono">{m.uid}</span>
                    </div>
                  </td>
                  <td>{m.status === 'blocked' ? <Pill tone="bad">Bị chặn</Pill> : <Pill tone="ok">Active</Pill>}</td>
                  <td>
                    <div className="chips">
                      {m.apps.map((a) => (
                        <span key={a.id} title={`Khóa: ${a.key}`}>
                          <Pill tone="accent">{appName(a.id)}</Pill>
                        </span>
                      ))}
                    </div>
                    <div className="u-sub tnum" style={{ marginTop: 4 }}>
                      {m.apps.length}/{total} app
                    </div>
                  </td>
                  <td>
                    {m.online ? (
                      <Pill tone="ok">
                        <span className="dot on live" /> Online
                      </Pill>
                    ) : (
                      <Pill tone="neutral">
                        <span className="dot off" /> {m.last}
                      </Pill>
                    )}
                  </td>
                  <td className="rowbtns">
                    {m.status === 'blocked' ? (
                      <button className="btn ok sm" onClick={() => onBlock(i, m)}>
                        Bỏ chặn
                      </button>
                    ) : (
                      <button className="btn bad sm" onClick={() => onBlock(i, m)}>
                        Chặn
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-foot">
          <span className="note">
            <b>Đang dùng</b> = số mini app user đã mở khóa / tổng mini app. Di chuột vào chip để xem <b>khóa nào</b>.{' '}
            <span className="mono">POST /sellers/me/members/{'{id}'}/block</span>
          </span>
        </div>
      </Card>
    </>
  )
}
