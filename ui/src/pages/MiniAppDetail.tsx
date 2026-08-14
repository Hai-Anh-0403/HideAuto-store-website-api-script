import { Fragment, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, CardHead } from '../ui/Card'
import { Pill } from '../ui/Pill'
import { useToast } from '../ui/Toast'
import { buildStatus, keyStatus, scriptStatus, versionStatus } from '../lib/pills'
import { useAppData } from '../store/AppData'
import type { Capabilities, Script } from '../types'

type Tab = 'ov' | 'ver' | 'keys' | 'mini'

export function MiniAppDetail() {
  const { id = '' } = useParams()
  const { getScript, createKey, revokeKey, addVersion, buildMini, submitScript } = useAppData()
  const { toast } = useToast()
  const nav = useNavigate()
  const [tab, setTab] = useState<Tab>('ov')
  const [openVer, setOpenVer] = useState<Set<number>>(new Set())

  const s = getScript(id)
  if (!s) {
    return (
      <div className="vhead">
        <h2>Không tìm thấy mini app</h2>
      </div>
    )
  }
  const st = scriptStatus[s.status]
  const toggleVer = (i: number) =>
    setOpenVer((prev) => {
      const n = new Set(prev)
      if (n.has(i)) n.delete(i)
      else n.add(i)
      return n
    })

  return (
    <>
      <button className="btn sm" onClick={() => nav('/mini-apps')}>
        ← Danh sách mini app
      </button>
      <div className="vhead" style={{ marginTop: 12 }}>
        <div>
          <h2>{s.name}</h2>
          <p>
            {s.cat} · {s.tags.map((t) => `#${t}`).join(' ')} · v{s.latest}
          </p>
        </div>
        <span style={{ marginLeft: 'auto' }}>
          <Pill tone={st.tone}>{st.label}</Pill>
        </span>
      </div>

      <div className="seg" style={{ marginBottom: 16 }}>
        <button className={tab === 'ov' ? 'on' : ''} onClick={() => setTab('ov')}>
          Tổng quan
        </button>
        <button className={tab === 'ver' ? 'on' : ''} onClick={() => setTab('ver')}>
          Phiên bản
        </button>
        <button className={tab === 'keys' ? 'on' : ''} onClick={() => setTab('keys')}>
          Khóa
        </button>
        <button className={tab === 'mini' ? 'on' : ''} onClick={() => setTab('mini')}>
          Đóng gói .exe
        </button>
      </div>

      {tab === 'ov' && (
        <DetailOverview
          s={s}
          onSubmit={() => {
            submitScript(s.id)
            toast('Đã gửi duyệt')
          }}
        />
      )}
      {tab === 'ver' && (
        <DetailVersions
          s={s}
          open={openVer}
          toggle={toggleVer}
          onUpload={() => {
            const v = addVersion(s.id)
            toast(`Đã tải version ${v} — chờ duyệt`)
          }}
        />
      )}
      {tab === 'keys' && (
        <DetailKeys
          s={s}
          onCreate={() => {
            createKey(s.id)
            toast(`Đã tạo khóa cho ${s.name}`)
          }}
          onRevoke={(i) => {
            revokeKey(s.id, i)
            toast('Đã thu hồi khóa')
          }}
        />
      )}
      {tab === 'mini' && (
        <DetailPackaging
          s={s}
          onBuild={() => {
            buildMini(s.id)
            toast('Đang đóng gói lại…')
          }}
        />
      )}
    </>
  )
}

function CapsChips({ caps }: { caps: Capabilities }) {
  return (
    <div className="chips">
      <Pill tone="accent">Browser: {caps.browser.join(', ')}</Pill>
      {caps.proxy && <Pill tone="neutral">Proxy</Pill>}
      {caps.fingerprint && <Pill tone="neutral">Fingerprint</Pill>}
      {caps.ai.length > 0 && <Pill tone="neutral">AI: {caps.ai.join(', ')}</Pill>}
      {caps.email && <Pill tone="neutral">Email</Pill>}
      {caps.sheets && <Pill tone="neutral">Google Sheets</Pill>}
      {caps.twofa && <Pill tone="neutral">2FA</Pill>}
      {caps.shell && <Pill tone="bad">⚠ Shell (runCommand)</Pill>}
    </div>
  )
}

function DetailOverview({ s, onSubmit }: { s: Script; onSubmit: () => void }) {
  return (
    <>
      <Card>
        <CardHead
          title="Khả năng & yêu cầu"
          actions={
            <span className="ep">
              <b>auto</b> từ graph
            </span>
          }
        />
        <div className="card-body">
          <div className="kv">
            <span className="klab">Node</span> <b className="tnum">{s.nodeCount}</b> node · {s.groups.join(', ')}
          </div>
          <div className="kv">
            <span className="klab">Yêu cầu</span>
            <CapsChips caps={s.caps} />
          </div>
          <div className="kv">
            <span className="klab">Biến cần điền</span>{' '}
            {s.vars.length ? (
              s.vars.map((v) => (
                <span key={v.k} className="keychip" style={{ marginRight: 5 }}>
                  {`{{${v.k}}}`}
                </span>
              ))
            ) : (
              <span className="u-sub">không</span>
            )}
          </div>
          <div className="kv">
            <span className="klab">Tương thích</span> hideflow ≥ <b>{s.minApp}</b>
          </div>
        </div>
      </Card>
      <Moderation s={s} onSubmit={onSubmit} />
    </>
  )
}

function Moderation({ s, onSubmit }: { s: Script; onSubmit: () => void }) {
  if (s.status === 'published') {
    return (
      <div className="banner ok">
        <span className="bi">✓</span>
        <div>
          <b>Đã duyệt & đang bán</b>Quét {s.scan.creds} secret ✓ ·{' '}
          {s.caps.shell ? '⚠ có dùng shell — đã cảnh báo trên listing' : 'không dùng shell'}.
        </div>
      </div>
    )
  }
  if (s.status === 'pending_review') {
    return (
      <div className="banner warn">
        <span className="bi">⏳</span>
        <div>
          <b>Đang chờ admin duyệt</b>Đã quét: {s.scan.creds} secret. Version hiển thị khi được duyệt.
        </div>
      </div>
    )
  }
  if (s.status === 'rejected') {
    return (
      <div className="banner bad">
        <span className="bi">⛔</span>
        <div>
          <b>Bị từ chối</b>
          {s.reject}
          {s.scan.paths && (
            <div className="chips" style={{ marginTop: 6 }}>
              {s.scan.paths.map((p) => (
                <span key={p} className="keychip">
                  🔑 {p}
                </span>
              ))}
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            <button className="btn sm" onClick={onSubmit}>
              Đã sửa — gửi lại
            </button>
          </div>
        </div>
      </div>
    )
  }
  return (
    <Card>
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Pill tone="neutral">Nháp</Pill>
        <span className="u-sub">Chưa gửi duyệt.</span>
        <div className="sp" />
        <button className="btn pri sm" onClick={onSubmit}>
          Gửi duyệt
        </button>
      </div>
    </Card>
  )
}

function DetailVersions({
  s,
  open,
  toggle,
  onUpload,
}: {
  s: Script
  open: Set<number>
  toggle: (i: number) => void
  onUpload: () => void
}) {
  return (
    <Card>
      <CardHead
        title="Phiên bản"
        actions={
          <button className="btn pri sm" onClick={onUpload}>
            ⬆ Tải version mới
          </button>
        }
      />
      <div className="tscroll">
        <table>
          <thead>
            <tr>
              <th>Version</th>
              <th>Thay đổi</th>
              <th>App ≥</th>
              <th>Trạng thái</th>
              <th>Ngày</th>
            </tr>
          </thead>
          <tbody>
            {s.versions.length ? (
              s.versions.map((v, i) => {
                const vs = versionStatus[v.status]
                return (
                  <Fragment key={v.v}>
                    <tr>
                      <td>
                        <span className="keychip">v{v.v}</span> {v.published && <Pill tone="ok">Đang phát hành</Pill>}
                      </td>
                      <td>
                        {v.log}
                        <div>
                          <button className="btn sm" style={{ marginTop: 5, padding: '2px 9px' }} onClick={() => toggle(i)}>
                            {open.has(i) ? 'Ẩn' : 'Xem chi tiết'}
                          </button>
                        </div>
                      </td>
                      <td className="tnum u-sub">{v.minApp}</td>
                      <td>
                        <Pill tone={vs.tone}>{vs.label}</Pill>
                      </td>
                      <td className="u-sub tnum">{v.at}</td>
                    </tr>
                    {open.has(i) && (
                      <tr>
                        <td colSpan={5} style={{ background: 'var(--surface-2)', padding: '6px 16px 12px' }}>
                          <div className="kv">
                            <span className="klab">Mô tả</span> {v.desc ?? v.log}
                          </div>
                          <div className="kv">
                            <span className="klab">Tương thích</span> hideflow ≥ <b>{v.minApp}</b>
                          </div>
                          <div className="kv">
                            <span className="klab">Kiểm duyệt</span> quét 0 secret ✓ · artifact{' '}
                            <span className="mono">workflow_graph</span> (tách từ .exe)
                          </div>
                          <div className="kv">
                            <span className="klab">Phát hành</span> {v.at}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })
            ) : (
              <tr>
                <td colSpan={5} className="u-sub" style={{ padding: '18px 16px' }}>
                  Chưa có phiên bản.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="card-foot">
        <span className="note">
          Mỗi version <b>quét lại & chờ duyệt</b>. <span className="mono">POST /sellers/me/scripts/{'{id}'}/versions</span>
        </span>
      </div>
    </Card>
  )
}

function DetailKeys({
  s,
  onCreate,
  onRevoke,
}: {
  s: Script
  onCreate: () => void
  onRevoke: (i: number) => void
}) {
  return (
    <Card>
      <CardHead
        title="Khóa kích hoạt của mini app này"
        actions={
          <button className="btn pri sm" onClick={onCreate}>
            ＋ Tạo khóa cho app này
          </button>
        }
      />
      <div className="tscroll">
        <table>
          <thead>
            <tr>
              <th>Khóa</th>
              <th>Nhãn</th>
              <th>Trạng thái</th>
              <th>Đã dùng</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {s.keys.length ? (
              s.keys.map((k, i) => {
                const ks = keyStatus[k.status]
                return (
                  <tr key={k.k}>
                    <td>
                      <span className="keychip">{k.k}</span>
                    </td>
                    <td>{k.label || '—'}</td>
                    <td>
                      <Pill tone={ks.tone}>{ks.label}</Pill>
                    </td>
                    <td className="tnum">
                      {k.used} / {k.max == null ? '∞' : k.max}
                    </td>
                    <td className="rowbtns">
                      {k.status === 'active' ? (
                        <button className="btn bad sm" onClick={() => onRevoke(i)}>
                          Thu hồi
                        </button>
                      ) : (
                        <button className="btn sm" disabled>
                          Thu hồi
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={5} className="u-sub" style={{ padding: '18px 16px' }}>
                  Chưa có khóa. Bấm "Tạo khóa cho app này".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="card-foot">
        <span className="note">
          User nhập <b>đúng khóa của app này</b> để mở <b>{s.name}</b>.{' '}
          <span className="mono">POST /sellers/me/scripts/{'{id}'}/keys</span>
        </span>
      </div>
    </Card>
  )
}

function DetailPackaging({ s, onBuild }: { s: Script; onBuild: () => void }) {
  const { toast } = useToast()
  return (
    <Card>
      <CardHead
        title="Đóng gói lại Mini-app (.exe)"
        actions={
          <button className="btn pri sm" onClick={onBuild}>
            ⚙ Đóng gói lại
          </button>
        }
      />
      {s.builds.length ? (
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>Nền tảng</th>
                <th>Từ version</th>
                <th>Cách build</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {s.builds.map((b, i) => {
                const bs = buildStatus[b.status]
                return (
                  <tr key={i}>
                    <td>
                      🪟 {b.plat} · <span className="mono">{b.arch}</span>
                    </td>
                    <td>
                      <span className="keychip">v{b.v}</span>
                    </td>
                    <td>
                      <Pill tone="neutral">server template</Pill>
                    </td>
                    <td>
                      <Pill tone={bs.tone}>{bs.label}</Pill>
                    </td>
                    <td className="rowbtns">
                      {b.status === 'ready' ? (
                        <button className="btn sm" onClick={() => toast('Đang tải .exe…')}>
                          ⬇ Tải
                        </button>
                      ) : (
                        <button className="btn sm" disabled>
                          —
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ padding: '22px 16px' }} className="u-sub">
          Chưa đóng gói. Store ghép <b>template mini-app rỗng</b> + <span className="mono">app.workflow</span> đã tách →{' '}
          <b>.exe</b>.
        </div>
      )}
      <div className="card-foot">
        <span className="note">
          <b>Hiện chỉ hỗ trợ .exe (Windows) — tạm thời.</b> Extract từ gói .exe → đóng gói lại khi tải.
        </span>
      </div>
    </Card>
  )
}
