/** Nhóm node — mỗi nhóm một hue cố định như app mẹ (design.md §3.5), dùng để phân
 *  loại chứ không trang trí. Chấm màu + nhãn, không chỉ dựa vào màu. */
export function GroupChips({ groups }: { groups: string[] }) {
  if (!groups.length) return null
  return (
    <div className="chips">
      {groups.map((g) => (
        <span key={g} className="groupchip" data-group={g}>
          {g}
        </span>
      ))}
    </div>
  )
}
