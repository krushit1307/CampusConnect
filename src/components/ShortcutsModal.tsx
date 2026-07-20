return (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <h1>TEST MODAL</h1>

      <p>HELLO WORLD</p>

      <div style={{ background: "red", color: "white", padding: "20px" }}>
        THIS SHOULD BE VISIBLE
      </div>

      <div>{"/"}</div>

      <div>{"Esc"}</div>

      <div>{"?"}</div>
    </DialogContent>
  </Dialog>
);
