import { useEffect, useState } from 'react';

export function useRelojEnVivo(intervaloMs = 10000) {
  const [, forzarRefresco] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forzarRefresco((n) => n + 1), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);
}