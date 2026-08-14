import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardHead } from '../ui/Card'
import { Pill } from '../ui/Pill'
import { fmtCount, scriptStatus } from '../lib/pills'
import { useAppData } from '../store/AppData'
import { useToast } from '../ui/Toast'

export function MiniApps() {
  const { scripts } = useAppData()
  const nav = useNavigate()
  const { toast } = useToast()
  const [showUpload, setShowUpload] = useState(false)

  return (
    <>
      <div className="vhead">
        <div>
          <h2>Mini app của tôi</h2>
          <p>Đăng & quản lý mini app (script automation) bán trên store.</p>
        </div>
        <span className="ep">
          <b>GET</b> /sellers/me/scripts
        </span>
      </div>

      {showUpload && (
        <Card>
          <CardHead
            title="Tải mini app lên"
            actions={
              <button className="btn sm" onClick={() => setShowUpload(false)}>
                ✕
              </button>
            }
          />
          <div style={{ padding: 16 }}>
            <div className="dropzone">
              ⬆ Kéo thả gói <b className="mono">.exe/.zip</b> (mini-app) hoặc file <b className="mono">.hideflow</b>
            </div>
            <div className="banner ok" style={{ marginTop: 14 }}>
              <span className="bi">🔎</span>
              <div>
                <b>Đã tách workflow từ GmailRegister.exe</b>Đọc <span className="mono">resources/app.workflow</span> → 0
                secret ✓ · 27 node · không dùng shell.
              </div>
            </div>
            <div className="kv">
              <span className="klab">Yêu cầu</span>
              <div className="chips">
                <Pill tone="accent">Browser: hidemium</Pill>
                <Pill tone="neutral">Proxy</Pill>
                <Pill tone="neutral">Fingerprint</Pill>
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <button
                className="btn pri sm"
                onClick={() => {
                  setShowUpload(false)
                  toast('Đã tải lên & gửi duyệt — đang quét credential')
                }}
              >
                Gửi duyệt
              </button>{' '}
              <span className="note" style={{ marginLeft: 8 }}>
                Metadata do store tự sinh từ graph.
              </span>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHead
          title={`${scripts.length} mini app`}
          actions={
            <button className="btn pri sm" onClick={() => setShowUpload((v) => !v)}>
              ⬆ Tải mini app lên
            </button>
          }
        />
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>Mini app</th>
                <th>Tags</th>
                <th>Trạng thái</th>
                <th>Phiên bản</th>
                <th>Tải</th>
                <th>Đánh giá</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {scripts.map((s) => {
                const st = scriptStatus[s.status]
                return (
                  <tr key={s.id} className="rowlink" onClick={() => nav(`/mini-apps/${s.id}`)}>
                    <td>
                      <div className="u-main">{s.name}</div>
                      <div className="u-sub">{s.cat}</div>
                    </td>
                    <td>
                      <div className="chips">
                        {s.tags.map((t) => (
                          <Pill key={t} tone="neutral">
                            {t}
                          </Pill>
                        ))}
                      </div>
                    </td>
                    <td>
                      <Pill tone={st.tone}>{st.label}</Pill>
                    </td>
                    <td>
                      <span className="keychip">v{s.latest}</span>
                      {s.versions.length > 0 && <span className="u-sub tnum"> · {s.versions.length} bản</span>}
                    </td>
                    <td className="tnum">{s.downloads ? fmtCount(s.downloads) : '—'}</td>
                    <td className="tnum">{s.rating ? `⭐ ${s.rating}` : '—'}</td>
                    <td className="u-sub">›</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="card-foot">
          <span className="note">Bấm 1 dòng để xem chi tiết: khả năng, phiên bản, khóa, đóng gói .exe, kiểm duyệt.</span>
        </div>
      </Card>
    </>
  )
}
