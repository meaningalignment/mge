export default function NavHeader({ baseTitle, baseUrl, title, subtitle }) {
  return (
    <header className="flex items-center justify-between py-4 px-6 bg-white border-b border-gray-200">
      <div className="flex items-center space-x-4">
        <Link to={baseUrl} className="flex items-center space-x-2">
          <ArrowLeft className="h-6 w-6" />
          <span>{baseTitle}</span>
        </Link>
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>
    </header>
  )
}
