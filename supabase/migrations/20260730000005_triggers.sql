-- Add triggers to the static metadata tables to purge the cache automatically on changes.

-- Majors table trigger
drop trigger if exists on_major_change on public.majors;
create trigger on_major_change
  after insert or update or delete on public.majors
  for each statement
  execute function public.notify_cdn_purge();

-- Semesters table trigger
drop trigger if exists on_semester_change on public.semesters;
create trigger on_semester_change
  after insert or update or delete on public.semesters
  for each statement
  execute function public.notify_cdn_purge();

-- Terms table trigger
drop trigger if exists on_term_change on public.terms;
create trigger on_term_change
  after insert or update or delete on public.terms
  for each statement
  execute function public.notify_cdn_purge();

-- Departments table trigger
drop trigger if exists on_department_change on public.departments;
create trigger on_department_change
  after insert or update or delete on public.departments
  for each statement
  execute function public.notify_cdn_purge();
