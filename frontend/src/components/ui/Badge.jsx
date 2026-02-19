export default function Badge({ children, style, className = '' }) {
  return (
    <span
      style={style}
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${className}`}
    >
      {children}
    </span>
  )
}
