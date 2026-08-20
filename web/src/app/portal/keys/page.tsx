'use client'

import { useState, type FormEvent } from 'react'
import { Pager } from '@/components/Pager'
import { PendingBanner } from '@/components/PendingBanner'
import { Pill } from '@/components/Pill'
import { useConfirm } from '@/components/Confirm'
import { useToast } from '@/components/Toast'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { copyText } from '@/lib/clipboard'
import { useErrorText } from '@/lib/errors'
import { fmtWhen, keyState } from '@/lib/pills'
import { useDebounced } from '@/lib/useDebounced'
import { useFetch } from '@/lib/useFetch'
import { useTitle } from '@/lib/useTitle'
import type {
  KeyCreate,
  KeyItem,
  KeyState,
  KeyStats,
  KeyUpdate,
  Page,
  Script,
} from '@/types'

const PAGE_SIZE = 20

/** `ALL` is the portal's own idea; the API just gets no `state` param. */
type StateFilter = KeyState | 'ALL'
const STATE_FILTERS: StateFilter[] = ['ALL', 'ACTIVE', 'EXPIRED', 'EXHAUSTED', 'REVOKED']

export default function KeysPage() {
  const { seller } = useAuth()
  const { t, lang } = useI18n()
  useTitle(t('keys.title'))
  const errorText = useErrorText()
  const approved = seller?.status === 'APPROVED'
  const { toast } = useToast()
  const confirm = useConfirm()

  const [skip, setSkip] = useState(0)
  const [state, setState] = useState<StateFilter>('ALL')
  const [scriptId, setScriptId] = useState('')
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const [fresh, setFresh] = useState<KeyItem[]>([])
  const [editing, setEditing] = useState<string | null>(null)

  // The box updates on every keystroke; the request waits for a pause.
  const search = useDebounced(q.trim())

  const filter = [
    state === 'ALL' ? '' : `state=${state}`,
    scriptId ? `scriptId=${encodeURIComponent(scriptId)}` : '',
    search ? `q=${encodeURIComponent(search)}` : '',
  ]
    .filter(Boolean)
    .join('&')

  const keys = useFetch(
    () =>
      approved
        ? api.get<Page<KeyItem>>(`/keys?skip=${skip}&limit=${PAGE_SIZE}${filter ? `&${filter}` : ''}`)
        : Promise.resolve(null),
    `keys:${approved}:${skip}:${filter}`,
  )
  const stats = useFetch(
    () => (approved ? api.get<KeyStats>('/keys/stats') : Promise.resolve(null)),
    `keyStats:${approved}`,
  )
  const scripts = useFetch(
    () => (approved ? api.get<Page<Script>>('/scripts?limit=100') : Promise.resolve(null)),
    `scriptsForKeys:${approved}`,
  )

  const rows = keys.data?.items ?? []
  const apps = scripts.data?.items ?? []
  const counts = stats.data

  const reload = () => {
    keys.reload()
    stats.reload()
  }

  const run = async (action: () => Promise<string>, fallback?: string) => {
    try {
      toast(await action())
    } catch (err) {
      toast(errorText(err, fallback))
    }
  }

  const copy = (value: string, message: string) =>
    void copyText(value).then((ok) => toast(ok ? message : t('keys.copyFailed')))

  const create = async (payload: KeyCreate) => {
    const made = await api.post<KeyItem[]>('/keys', payload)
    setFresh(made)
    setCreating(false)
    setSkip(0)
    reload()
    toast(t('keys.created', { count: made.length }))
  }

  const countFor = (value: StateFilter): number | null => {
    if (!counts) return null
    switch (value) {
      case 'ALL':
        return counts.total
      case 'ACTIVE':
        return counts.active
      case 'EXPIRED':
        return counts.expired
      case 'EXHAUSTED':
        return counts.exhausted
      case 'REVOKED':
        return counts.revoked
    }
  }

  return (
    <>
      <div className="vhead">
        <div>
          <h2>{t('keys.title')}</h2>
          <p>{t('keys.subtitle')}</p>
        </div>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            className="btn sm"
            disabled={!approved || !keys.data?.total}
            onClick={() =>
              run(async () => {
                const headers = await api.download(
                  `/keys/export${filter ? `?${filter}` : ''}`,
                  'keys.csv',
                )
                // The server caps the sheet; saying so beats handing a reseller a short list.
                return headers.get('X-Export-Truncated') === 'true'
                  ? t('keys.exportedTruncated')
                  : t('keys.exported')
              })
            }
          >
            {t('keys.export')}
          </button>
          <button
            className="btn pri sm"
            disabled={!approved}
            onClick={() => setCreating((open) => !open)}
          >
            {creating ? t('keys.newClose') : t('keys.new')}
          </button>
        </span>
      </div>

      <PendingBanner />
      {(keys.error ?? stats.error) && (
        <div className="state bad">{keys.error ?? stats.error}</div>
      )}

      {creating && <CreateKeys apps={apps} onCreate={create} onCancel={() => setCreating(false)} />}

      {fresh.length > 0 && (
        <FreshKeys
          keys={fresh}
          onCopy={copy}
          onDismiss={() => setFresh([])}
        />
      )}

      <div className="card">
        <div className="card-h">
          <h3>{t('keys.count', { count: keys.data?.total ?? 0 })}</h3>
          <div className="sp" />
          <input
            className="search"
            placeholder={t('keys.search')}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setSkip(0)
            }}
          />
          <select
            className="input sm"
            style={{ width: 'auto', marginLeft: 8 }}
            value={scriptId}
            onChange={(e) => {
              setScriptId(e.target.value)
              setSkip(0)
            }}
          >
            <option value="">{t('keys.filter.anyApp')}</option>
            <option value="none">{t('keys.shopWide')}</option>
            {apps.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ padding: '0 16px 12px' }}>
          <div className="seg">
            {STATE_FILTERS.map((value) => {
              const n = countFor(value)
              return (
                <button
                  key={value}
                  className={state === value ? 'on' : ''}
                  onClick={() => {
                    setState(value)
                    setSkip(0)
                  }}
                >
                  {t(`keys.filter.${value.toLowerCase()}`)}
                  {n === null ? '' : ` (${n})`}
                </button>
              )
            })}
          </div>
        </div>

        {keys.loading && !keys.data ? (
          <>
            <div className="skel" />
            <div className="skel" />
            <div className="skel" />
          </>
        ) : !rows.length ? (
          <div className="empty">
            <div className="icon">🔑</div>
            <b>{filter ? t('keys.emptyFilteredTitle') : t('detailKeys.emptyTitle')}</b>
            <p>{filter ? t('keys.emptyFilteredBody') : t('keys.empty')}</p>
            {!filter && (
              <button className="btn pri sm" disabled={!approved} onClick={() => setCreating(true)}>
                {t('keys.new')}
              </button>
            )}
          </div>
        ) : (
          <div className="tscroll">
            <table>
              <thead>
                <tr>
                  <th>{t('keys.col.key')}</th>
                  <th>{t('keys.col.app')}</th>
                  <th>{t('keys.col.label')}</th>
                  <th>{t('keys.col.status')}</th>
                  <th>{t('keys.col.used')}</th>
                  <th className="opt">{t('keys.col.created')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((k) =>
                  editing === k.id ? (
                    <EditKeyRow
                      key={k.id}
                      item={k}
                      onCancel={() => setEditing(null)}
                      onSave={(payload) =>
                        run(async () => {
                          await api.patch<KeyItem>(`/keys/${k.id}`, payload)
                          setEditing(null)
                          reload()
                          return t('keys.updated')
                        })
                      }
                    />
                  ) : (
                    <tr key={k.id}>
                      <td>
                        <button
                          className="keychip"
                          title={t('keys.copy')}
                          style={{ cursor: 'pointer', border: 0 }}
                          onClick={() => copy(k.key, t('keys.copied'))}
                        >
                          {k.key}
                        </button>
                      </td>
                      <td>
                        {k.script ? (
                          <Pill tone="accent">{k.script.name}</Pill>
                        ) : (
                          <Pill tone="neutral">{t('keys.shopWide')}</Pill>
                        )}
                      </td>
                      <td>
                        {k.label ?? '—'}
                        {k.expiresAt && (
                          <div className="u-sub">
                            {t('detailKeys.expires')}:{' '}
                            {new Date(k.expiresAt).toLocaleDateString(lang)}
                          </div>
                        )}
                      </td>
                      <td>
                        <Pill tone={keyState[k.state].tone}>{t(keyState[k.state].key)}</Pill>
                      </td>
                      <td className="tnum">
                        {k.usedCount} / {k.maxUses ?? '∞'}
                      </td>
                      <td className="u-sub tnum opt">
                        {fmtWhen(k.createdAt, lang, t('time.now'))}
                      </td>
                      <td className="rowbtns">
                        <button className="btn sm" onClick={() => setEditing(k.id)}>
                          {t('keys.edit')}
                        </button>
                        {k.status === 'REVOKED' ? (
                          <button
                            className="btn sm"
                            onClick={() =>
                              run(async () => {
                                await api.patch(`/keys/${k.id}/restore`)
                                reload()
                                return t('keys.restored')
                              })
                            }
                          >
                            {t('keys.restore')}
                          </button>
                        ) : (
                          <button
                            className="btn bad sm"
                            onClick={() =>
                              void confirm({
                                title: t('keys.revoke'),
                                body: t('keys.revokeConfirm'),
                                confirmLabel: t('keys.revoke'),
                                danger: true,
                              }).then(({ ok }) => {
                                if (!ok) return
                                void run(async () => {
                                  await api.patch(`/keys/${k.id}/revoke`)
                                  reload()
                                  return t('keys.revoked')
                                }, 'keys.revokeFailed')
                              })
                            }
                          >
                            {t('keys.revoke')}
                          </button>
                        )}
                        {k.usedCount === 0 && (
                          <button
                            className="btn bad sm"
                            onClick={() =>
                              void confirm({
                                title: t('keys.delete'),
                                body: t('keys.deleteConfirm'),
                                confirmLabel: t('keys.delete'),
                                danger: true,
                              }).then(({ ok }) => {
                                if (!ok) return
                                void run(async () => {
                                  await api.del(`/keys/${k.id}`)
                                  reload()
                                  return t('keys.deleted')
                                })
                              })
                            }
                          >
                            {t('keys.delete')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
        {keys.data && (
          <Pager skip={skip} limit={PAGE_SIZE} total={keys.data.total} onChange={setSkip} />
        )}
        <div className="card-foot">
          <span className="note">{t('keys.foot')}</span>
        </div>
      </div>
    </>
  )
}

/* ---------- Create ---------- */

function CreateKeys({
  apps,
  onCreate,
  onCancel,
}: {
  apps: Script[]
  onCreate: (payload: KeyCreate) => Promise<void>
  onCancel: () => void
}) {
  const { t } = useI18n()
  const errorText = useErrorText()
  const [scriptId, setScriptId] = useState('')
  const [label, setLabel] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [maxUses, setMaxUses] = useState('1')
  const [expiresAt, setExpiresAt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const count = Math.min(Math.max(parseInt(quantity, 10) || 1, 1), 200)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onCreate({
        // '' means shop-wide here: the API takes the absence of scriptId, not an empty string.
        scriptId: scriptId || null,
        label: label.trim() || undefined,
        maxUses: maxUses ? Number(maxUses) : undefined,
        // `datetime-local` has no timezone; Date → toISOString hands the API UTC.
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        quantity: count,
      })
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <div className="card-h">
        <h3>{t('keys.newTitle')}</h3>
      </div>
      <form onSubmit={submit} style={{ padding: 16 }}>
        {error != null && <div className="state bad">{errorText(error)}</div>}
        <div className="grid2">
          <label className="field">
            <span>{t('keys.form.app')}</span>
            <select
              className="input"
              value={scriptId}
              onChange={(e) => setScriptId(e.target.value)}
            >
              <option value="">{t('keys.form.appAll')}</option>
              {apps.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('keys.col.label')}</span>
            <input
              className="input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('detailKeys.labelPlaceholder')}
              maxLength={100}
            />
          </label>
        </div>
        <div className="grid2">
          <label className="field">
            <span>{t('keys.form.quantity')}</span>
            <input
              className="input tnum"
              type="number"
              min={1}
              max={200}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
          <label className="field">
            <span>{t('detailKeys.maxUses')}</span>
            <input
              className="input tnum"
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder={t('detailKeys.maxUsesPlaceholder')}
            />
          </label>
        </div>
        <div className="grid2">
          <label className="field">
            <span>{t('detailKeys.expires')}</span>
            <input
              className="input"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </label>
        </div>
        <div className="formrow">
          <button className="btn pri sm" type="submit" disabled={busy}>
            {busy ? t('keys.form.creating') : t('keys.form.submit', { count })}
          </button>
          <button className="btn sm" type="button" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <span className="note">{t('keys.form.hint')}</span>
        </div>
      </form>
    </div>
  )
}

/* ---------- Just-created keys ---------- */

function FreshKeys({
  keys,
  onCopy,
  onDismiss,
}: {
  keys: KeyItem[]
  onCopy: (value: string, message: string) => void
  onDismiss: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="card">
      <div className="card-h">
        <h3>{t('keys.freshTitle', { count: keys.length })}</h3>
        <div className="sp" />
        <button
          className="btn sm"
          onClick={() => onCopy(keys.map((k) => k.key).join('\n'), t('keys.copiedAll', { count: keys.length }))}
        >
          {t('keys.copyAll')}
        </button>
        <button className="btn sm" style={{ marginLeft: 8 }} onClick={onDismiss}>
          {t('keys.freshDismiss')}
        </button>
      </div>
      <div className="card-body">
        <div className="chips">
          {keys.map((k) => (
            <button
              key={k.id}
              className="keychip"
              title={t('keys.copy')}
              style={{ cursor: 'pointer', border: 0 }}
              onClick={() => onCopy(k.key, t('keys.copied'))}
            >
              {k.key}
            </button>
          ))}
        </div>
      </div>
      <div className="card-foot">
        <span className="note">{t('keys.freshFoot')}</span>
      </div>
    </div>
  )
}

/* ---------- Inline edit ---------- */

/** `datetime-local` wants `YYYY-MM-DDTHH:mm` in *local* time, not the ISO string. */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function EditKeyRow({
  item,
  onSave,
  onCancel,
}: {
  item: KeyItem
  onSave: (payload: KeyUpdate) => void
  onCancel: () => void
}) {
  const { t } = useI18n()
  const [label, setLabel] = useState(item.label ?? '')
  const [maxUses, setMaxUses] = useState(item.maxUses === null ? '' : String(item.maxUses))
  const [expiresAt, setExpiresAt] = useState(toLocalInput(item.expiresAt))

  return (
    <tr>
      <td>
        <span className="keychip">{item.key}</span>
      </td>
      <td colSpan={5}>
        <div className="grid2">
          <label className="field">
            <span>{t('keys.col.label')}</span>
            <input
              className="input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('detailKeys.labelPlaceholder')}
              maxLength={100}
            />
          </label>
          <label className="field">
            <span>{t('detailKeys.maxUses')}</span>
            <input
              className="input tnum"
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder={t('detailKeys.maxUsesPlaceholder')}
            />
          </label>
        </div>
        <label className="field">
          <span>{t('detailKeys.expires')}</span>
          <input
            className="input"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </label>
        <span className="note">{t('keys.editHint')}</span>
      </td>
      <td className="rowbtns">
        <button
          className="btn pri sm"
          onClick={() => {
            // Only changed fields go over the wire. Replaying an already-past `expiresAt`
            // is what made an expired key impossible to relabel.
            const payload: KeyUpdate = {}
            if ((label.trim() || null) !== (item.label ?? null)) {
              payload.label = label.trim() || null
            }
            const nextMax = maxUses ? Number(maxUses) : null
            if (nextMax !== item.maxUses) payload.maxUses = nextMax
            if (expiresAt !== toLocalInput(item.expiresAt)) {
              payload.expiresAt = expiresAt ? new Date(expiresAt).toISOString() : null
            }
            onSave(payload)
          }}
        >
          {t('keys.save')}
        </button>
        <button className="btn sm" onClick={onCancel}>
          {t('common.cancel')}
        </button>
      </td>
    </tr>
  )
}
