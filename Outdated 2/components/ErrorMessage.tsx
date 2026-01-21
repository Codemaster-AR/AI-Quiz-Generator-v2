
import React from 'react';

const ErrorMessage = ({ message }: { message: string }) => (
  <div className="p-4 my-4 text-center bg-red-900/50 border border-red-700 text-red-300 rounded-lg">
    <p className="font-bold">An Error Occurred</p>
    <p className="text-sm">{message}</p>
  </div>
);

export default ErrorMessage;
