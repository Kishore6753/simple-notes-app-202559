import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Notes header', () => {
  render(<App />);
  const heading = screen.getByText(/Notes/i);
  expect(heading).toBeInTheDocument();
});
