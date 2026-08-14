import { useState } from 'react'
import { Card, CardHead } from '../ui/Card'
import { Pill } from '../ui/Pill'
import { useAppData } from '../store/AppData'

export function Overview() {
  const { scripts, members } = useAppData()
  const [pending, setPending] = useState(false)
  const appName = (id: string) => scripts.find((s) => s.id === id)?.name ?? id
  const online = members.filter((m) => m.online).length
  const activeKeys = scripts.reduce((n, s) => n + s.keys.filter((k) => k.status === 'active').length, 0)

  return (
    <>
      <div className="vhead">
        <div>
          <h2>Tổng quan</h2>
          <p>
            Cửa hàng <b>AutoHide Studio</b> — bán mini app (script automation) cho hideflow.
          </p>
        </div>
        <span className="ep">
          <b>GET</b> /sellers/me
        </span>
      </div>

      {pending ? (
        <div className="banner warn">
          <span className="bi">⏳</span>
          <div>
            <b>Đang chờ admin duyệt</b>Chưa thể phát hành khóa — thao tác seller trả về 403 tới khi được duyệt.{' '}
            <button className="btn sm" onClick={() => setPending(false)}>
              Xem trạng thái đã duyệt
            </button>
          </div>
        </div>
      ) : (
        <div className="banner ok">
          <span className="bi">✓</span>
          <div>
            <b>Tài khoản đã được duyệt</b>Bạn có thể phát hành khóa và quản lý người dùng.{' '}
            <button className="btn sm" onClick={() => setPending(true)}>
              Xem thử trạng thái chờ duyệt
            </button>
          </div>
        </div>
      )}

      <div className="tiles">
        <div className="tile">
          <div className="k">Người dùng</div>
          <div className="v tnum">{members.length}</div>
          <div className="s">đã nhập khóa</div>
        </div>
        <div className="tile">
          <div className="k">
            <span className="dot on" /> Đang online
          </div>
          <div className="v tnum" style={{ color: 'var(--ok)' }}>
            {online}
          </div>
          <div className="s">trong 5 phút qua</div>
        </div>
        <div className="tile">
          <div className="k">Khóa hoạt động</div>
          <div className="v tnum">{activeKeys}</div>
          <div className="s">trên tất cả app</div>
        </div>
        <div className="tile">
          <div className="k">Mini app</div>
          <div className="v tnum">{scripts.length}</div>
          <div className="s">đang quản lý</div>
        </div>
      </div>

      <Card>
        <CardHead
          title="Người dùng gần đây"
          actions={
            <span className="ep">
              <b>GET</b> /sellers/me/members
            </span>
          }
        />
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>Người dùng</th>
                <th>Trạng thái</th>
                <th>Hoạt động</th>
                <th>Đang dùng</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.uid}>
                  <td>
                    <div className="u-main">{m.name}</div>
                    <div className="u-sub">{m.email}</div>
                  </td>
                  <td>{m.status === 'blocked' ? <Pill tone="bad">Bị chặn</Pill> : <Pill tone="ok">Active</Pill>}</td>
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
                  <td>
                    <div className="chips">
                      {m.apps.map((a) => (
                        <Pill key={a.id} tone="accent">
                          {appName(a.id)}
                        </Pill>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
