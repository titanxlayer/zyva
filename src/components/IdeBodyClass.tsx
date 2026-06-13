'use client';
import { useEffect } from 'react';

/** Applies ide-layout class to body so overflow:hidden only affects the IDE page */
export default function IdeBodyClass() {
  useEffect(() => {
    document.body.classList.add('ide-layout');
    document.body.classList.remove('page-layout');
    return () => {
      document.body.classList.remove('ide-layout');
      document.body.classList.add('page-layout');
    };
  }, []);
  return null;
}
