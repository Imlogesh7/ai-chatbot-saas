export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container-fluid">
        <div className="flex justify-center items-center py-5">
          <span className="text-sm text-muted-foreground">
            {currentYear} &copy; SaaS Platform. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  );
}
