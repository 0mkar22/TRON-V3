import { render, screen } from '@testing-library/react'

describe('Dummy test', () => {
  it('renders a dummy test', () => {
    document.body.innerHTML = '<div>Hello Jest</div>'
    expect(screen.getByText('Hello Jest')).toBeInTheDocument()
  })
})
