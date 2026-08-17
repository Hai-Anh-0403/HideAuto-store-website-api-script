/** Logo HideAuto — dựng lại đúng file export (`exports/HideAuto-*.svg`), không vẽ lại.
 *
 * Logo là một tile có nền riêng nên đặt cạnh gì cũng không đụng màu brand của portal;
 * vì vậy màu ở đây cố định theo bộ nhận diện, không đọc token theme.
 * `detail` thêm đường node đi xuyên chữ H — chỉ bật ở cỡ ≥ 48px, nhỏ hơn thì nét 2px
 * của nó mảnh tới mức mất hẳn.
 */

const INK = '#0d1a1f'
const TEAL = '#2fb8a6'
const LINE = '#e9eeed'

export function BrandLogo({ size = 28, detail = false }: { size?: number; detail?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      // Chỗ nào dùng logo cũng có sẵn chữ "storeAutoHide" bên cạnh.
      aria-hidden
      focusable="false"
    >
      <rect width="100" height="100" rx={detail ? 22 : 18} fill={INK} />
      <g transform={detail ? 'translate(7,7) scale(0.86)' : undefined}>
        <rect x="29" y="25" width="12" height="50" rx="2.5" fill={TEAL} />
        <rect x="59" y="25" width="12" height="50" rx="2.5" fill={TEAL} />
        <rect x="29" y="42.5" width="42" height="12" rx="2.5" fill={TEAL} />
        {detail && (
          <>
            <polyline
              points="14,30 45,57 58,39 86,66"
              fill="none"
              stroke={LINE}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {[
              [14, 30],
              [45, 57],
              [58, 39],
              [86, 66],
            ].map(([cx, cy]) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3.8" fill={LINE} />
            ))}
          </>
        )}
      </g>
    </svg>
  )
}
