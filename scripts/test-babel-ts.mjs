import Babel from '@babel/standalone';

const code = `
  import React, { FC } from 'react';
  interface Props { name: string; }
  const Hello: FC<Props> = ({ name }) => <div>Hello {name}</div>;
  export default Hello;
`;

try {
  const result = Babel.transform(code, {
    presets: ['react', 'typescript'],
    filename: 'test.tsx'
  });
  console.log("SUCCESS:");
  console.log(result.code);
} catch (e) {
  console.log("ERROR:", e.message);
}
