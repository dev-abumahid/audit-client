/* eslint-disable @typescript-eslint/no-explicit-any */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">
          {label}
        </p>
        <p className="text-sm text-green-600 dark:text-green-400">
          ${payload[0].value.toLocaleString()}
        </p>
      </div>
    )
  }
  return null
}

export default CustomTooltip
