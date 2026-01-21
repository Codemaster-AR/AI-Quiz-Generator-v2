
import React from 'react';

const Loader = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center p-8 text-center">
    <div className="w-12 h-12 border-4 border-t-transparent border-indigo-500 rounded-full animate-spin"></div>
    <p className="mt-4 text-lg text-slate-300">{message}</p>
  </div>
);

export default Loader;
