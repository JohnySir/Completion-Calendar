import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Completion Calendar heading', () => {
  render(<App />);
  const headingElement = screen.getByText(/Completion Calendar/i);
  expect(headingElement).toBeInTheDocument();
});
