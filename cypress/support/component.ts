import { mount } from 'cypress/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../src/contexts/ThemeContext';
import { MemoryRouter } from 'react-router-dom';
import '../../src/index.css'; // Import global tailwind styles

// Augment the Cypress namespace to include custom commands
declare global {
  namespace Cypress {
    interface Chainable {
      mount: typeof mount;
      /**
       * Custom command to drag an element to a specific coordinate offset.
       * Used for testing drag-and-drop event scheduling logic.
       */
      dragAndDrop(offsetX: number, offsetY: number): Chainable<JQuery<HTMLElement>>;
    }
  }
}

/**
 * Wraps the component in necessary global providers (Theme, Query, Router)
 * before mounting it in the Cypress Component Testing runner.
 */
Cypress.Commands.add('mount', (component, options = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retries in tests for faster execution
      },
    },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light">
          <MemoryRouter>
            {children}
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );

  return mount(component, { ...options, wrapper });
});

/**
 * Custom command to simulate complex HTML5 drag and drop events.
 * Standard Cypress `.trigger()` often fails with complex DnD libraries.
 */
Cypress.Commands.add('dragAndDrop', { prevSubject: 'element' }, (subject, offsetX, offsetY) => {
  const rect = subject[0].getBoundingClientRect();
  const startX = rect.x + rect.width / 2;
  const startY = rect.y + rect.height / 2;
  const endX = startX + offsetX;
  const endY = startY + offsetY;

  cy.wrap(subject)
    .trigger('mousedown', { button: 0, clientX: startX, clientY: startY, force: true })
    .trigger('mousemove', { clientX: startX + 10, clientY: startY + 10, force: true }) // Initiate drag
    .wait(100) // Small delay to allow DnD library to register the drag start
    .trigger('mousemove', { clientX: endX, clientY: endY, force: true })
    .trigger('mouseup', { clientX: endX, clientY: endY, force: true });
});
