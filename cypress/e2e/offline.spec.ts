describe("Offline Mode", () => {
  afterEach(() => {
    // Restore the network connection at the end of the test.
    cy.wrap(
      Cypress.automation("remote:debugger:protocol", {
        command: "Network.emulateNetworkConditions",
        params: {
          offline: false,
          latency: 0,
          downloadThroughput: -1,
          uploadThroughput: -1,
        },
      }),
      { log: false },
    );
  });

  it("should boot the React application from the Service Worker cache when offline", () => {
    // 1. Enable the Network domain
    cy.wrap(
      Cypress.automation("remote:debugger:protocol", {
        command: "Network.enable",
      }),
      { log: false },
    );

    // 2. Navigate to the homepage online to install/activate the service worker
    cy.visit("/");

    // 3. Mathematically await the service worker registration to be ready and controlling the page
    cy.window().then({ timeout: 15000 }, (win) => {
      if ("serviceWorker" in win.navigator) {
        return win.navigator.serviceWorker.ready.then((reg) => {
          if (win.navigator.serviceWorker.controller) {
            return reg;
          }
          return new Cypress.Promise((resolve) => {
            win.navigator.serviceWorker.addEventListener("controllerchange", () => {
              resolve(reg);
            });
          });
        });
      }
    });

    // 4. Sever the network connection using the CDP command
    cy.wrap(
      Cypress.automation("remote:debugger:protocol", {
        command: "Network.emulateNetworkConditions",
        params: {
          offline: true,
          latency: 0,
          downloadThroughput: 0,
          uploadThroughput: 0,
        },
      }),
      { log: false },
    );

    // 5. Reload the page while offline
    cy.reload();

    // 6. Assert that the page successfully renders the HTML layout (proving the Service Worker intercepted it)
    cy.title().should("eq", "CampusConnect");
    cy.get("#root").should("exist");
    cy.contains("Under Maintenance").should("be.visible");
    cy.contains("Database connection unavailable").should("be.visible");
  });
});
