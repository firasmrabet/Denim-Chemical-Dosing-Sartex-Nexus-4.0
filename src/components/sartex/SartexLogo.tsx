export function SartexLogo({ className = "h-10 w-auto" }: { className?: string }) {
  return (
    <div className={`relative flex items-center font-bold text-2xl tracking-widest text-white ${className}`}>
      SARTEX<span className="text-cyan-400 font-light ml-1">Group</span>
    </div>
  );
}
