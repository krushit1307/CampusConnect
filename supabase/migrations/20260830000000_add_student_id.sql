ALTER TABLE profiles ADD COLUMN student_id_number TEXT UNIQUE;

CREATE INDEX idx_profiles_student_id ON profiles(student_id_number);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, student_id_number)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'student_id_number'
  );
  RETURN new;
END;
$$$ LANGUAGE plpgsql SECURITY DEFINER;
