const sizes = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-9 h-9 border-[3px]',
}

export default function Spinner({ size = 'md' }) {
  return (
    <div
      className={`${sizes[size]} rounded-full animate-spin`}
      style={{ borderColor: '#3a3028', borderTopColor: '#ad974f' }}
    />
  )
}
