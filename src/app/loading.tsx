export default function Loading() {
  return (
    <div className="mx-auto grid max-w-store gap-4 px-4 py-16">
      <div className="skeleton h-12 w-1/2" />
      <div className="skeleton h-64 w-full" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="skeleton h-72" />
        <div className="skeleton h-72" />
        <div className="skeleton h-72" />
        <div className="skeleton h-72" />
      </div>
    </div>
  );
}
