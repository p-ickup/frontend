interface FileUploadInfoProps {
  acceptedFormats: string[]
  maxSize: string
  className?: string
}

export function FileUploadInfo({
  acceptedFormats,
  maxSize,
  className = '',
}: FileUploadInfoProps) {
  return (
    <div className={`text-xs text-gray-600 ${className}`}>
      <p>Accepted formats: {acceptedFormats.join(', ').toUpperCase()}</p>
      <p>Maximum size: {maxSize}</p>
    </div>
  )
}
