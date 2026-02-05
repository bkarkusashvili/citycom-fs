interface ErrorAlertProps {
  message: string | null;
}

export function ErrorAlert({ message }: ErrorAlertProps) {
  if (!message) return null;

  return (
    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
      {message}
    </div>
  );
}
