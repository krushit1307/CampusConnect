-- Add triggers to the static metadata tables to purge the cache automatically on changes.

-- Majors table trigger
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'majors' AND n.nspname = 'public') THEN
    drop trigger if exists on_major_change on public.majors;
    create trigger on_major_change
      after insert or update or delete on public.majors
      for each statement
      execute function public.notify_cdn_purge();
  END IF;
END $$;

-- Semesters table trigger
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'semesters' AND n.nspname = 'public') THEN
    drop trigger if exists on_semester_change on public.semesters;
    create trigger on_semester_change
      after insert or update or delete on public.semesters
      for each statement
      execute function public.notify_cdn_purge();
  END IF;
END $$;

-- Terms table trigger
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'terms' AND n.nspname = 'public') THEN
    drop trigger if exists on_term_change on public.terms;
    create trigger on_term_change
      after insert or update or delete on public.terms
      for each statement
      execute function public.notify_cdn_purge();
  END IF;
END $$;

-- Departments table trigger
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'departments' AND n.nspname = 'public') THEN
    drop trigger if exists on_department_change on public.departments;
    create trigger on_department_change
      after insert or update or delete on public.departments
      for each statement
      execute function public.notify_cdn_purge();
  END IF;
END $$;
