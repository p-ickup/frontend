interface ManyBagsNoticeProps {
  open: boolean
  onConfirm: () => void // when they choose to proceed
  onCancel: () => void // when they choose to go back and edit
}

export default function ManyBagsNotice({
  open,
  onConfirm,
  onCancel,
}: ManyBagsNoticeProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="flex w-96 flex-col items-center justify-center space-y-4 rounded-2xl bg-white p-8 text-center shadow-xl">
        <div className="text-3xl font-semibold text-yellow-600">
          ⚠️ Extra Bags Notice
        </div>
        <p className="text-gray-600">
          You’ve entered 4 or more bags. Please note that you will likely have
          to get an Uber/Lyft XL (which will likely cost more). Please confirm
          this is correct.
        </p>
        <div className="mt-4 flex w-full justify-end space-x-4">
          <button
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-100"
          >
            Edit Match Form
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700"
          >
            Okay
          </button>
        </div>
      </div>
    </div>
  )
}
