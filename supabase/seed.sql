-- Shared development data: fictional restaurants in Austin, TX and their menus.
-- Runs automatically on `supabase db reset`. Demo users and their private
-- ratings are created by `npm run seed` (scripts/seed.ts) via the admin API.

insert into public.restaurants (id, source, name, address, city, country, cuisine, lat, lng, created_by) values
  ('a0000000-0000-4000-8000-000000000001', 'user', 'Maison Clé',        '1204 E 6th St',        'Austin', 'United States', 'French bistro', 30.2652, -97.7290, null),
  ('a0000000-0000-4000-8000-000000000002', 'user', 'Nopal & Smoke',     '2310 S Lamar Blvd',    'Austin', 'United States', 'Mexican',       30.2445, -97.7811, null),
  ('a0000000-0000-4000-8000-000000000003', 'user', 'Kōyō Ramen',        '507 W 29th St',        'Austin', 'United States', 'Japanese',      30.2961, -97.7425, null),
  ('a0000000-0000-4000-8000-000000000004', 'user', 'Trattoria Lucca',   '1600 S Congress Ave',  'Austin', 'United States', 'Italian',       30.2489, -97.7499, null),
  ('a0000000-0000-4000-8000-000000000005', 'user', 'Saffron Table',     '4410 Burnet Rd',       'Austin', 'United States', 'Indian',        30.3155, -97.7395, null),
  ('a0000000-0000-4000-8000-000000000006', 'user', 'Pecan Street Café', '310 E 6th St',         'Austin', 'United States', 'American',      30.2672, -97.7400, null);

insert into public.dishes (restaurant_id, name, description, category, created_by) values
  -- Maison Clé
  ('a0000000-0000-4000-8000-000000000001', 'Steak tartare',      'Hand-cut beef, cornichon, egg yolk',     'starter', null),
  ('a0000000-0000-4000-8000-000000000001', 'French onion soup',  'Gruyère crouton, veal stock',            'starter', null),
  ('a0000000-0000-4000-8000-000000000001', 'Escargots',          'Garlic-parsley butter, baguette',        'starter', null),
  ('a0000000-0000-4000-8000-000000000001', 'Duck confit',        'Lentils du Puy, frisée, cherry jus',     'main',    null),
  ('a0000000-0000-4000-8000-000000000001', 'Moules frites',      'White wine, shallot, herbed fries',      'main',    null),
  ('a0000000-0000-4000-8000-000000000001', 'Steak frites',       'Hanger steak, sauce au poivre',          'main',    null),
  ('a0000000-0000-4000-8000-000000000001', 'Crème brûlée',       'Tahitian vanilla, burnt sugar',          'dessert', null),
  ('a0000000-0000-4000-8000-000000000001', 'Kir royale',         'Crème de cassis, crémant',               'drink',   null),
  -- Nopal & Smoke
  ('a0000000-0000-4000-8000-000000000002', 'Elote',              'Charred corn, cotija, chile-lime mayo',  'starter', null),
  ('a0000000-0000-4000-8000-000000000002', 'Guacamole',          'Made to order, totopos',                 'starter', null),
  ('a0000000-0000-4000-8000-000000000002', 'Birria tacos',       'Braised beef, consomé for dipping',      'main',    null),
  ('a0000000-0000-4000-8000-000000000002', 'Tacos al pastor',    'Spit-roasted pork, pineapple',           'main',    null),
  ('a0000000-0000-4000-8000-000000000002', 'Mole enchiladas',    'Chicken, mole poblano, sesame',          'main',    null),
  ('a0000000-0000-4000-8000-000000000002', 'Churros',            'Cinnamon sugar, cajeta',                 'dessert', null),
  ('a0000000-0000-4000-8000-000000000002', 'Horchata',           null,                                     'drink',   null),
  -- Kōyō Ramen
  ('a0000000-0000-4000-8000-000000000003', 'Gyoza',              'Pork and cabbage, crisp-bottomed',       'starter', null),
  ('a0000000-0000-4000-8000-000000000003', 'Karaage',            'Fried chicken thigh, yuzu kosho mayo',   'starter', null),
  ('a0000000-0000-4000-8000-000000000003', 'Tonkotsu ramen',     'Pork bone broth, chashu, ajitama',       'main',    null),
  ('a0000000-0000-4000-8000-000000000003', 'Shoyu ramen',        'Chicken-dashi broth, menma, nori',       'main',    null),
  ('a0000000-0000-4000-8000-000000000003', 'Spicy miso ramen',   'Ground pork, chili oil, corn',           'main',    null),
  ('a0000000-0000-4000-8000-000000000003', 'Matcha soft serve',  null,                                     'dessert', null),
  ('a0000000-0000-4000-8000-000000000003', 'Yuzu highball',      'Japanese whisky, yuzu, soda',            'drink',   null),
  -- Trattoria Lucca
  ('a0000000-0000-4000-8000-000000000004', 'Burrata',            'Heirloom tomato, basil oil',             'starter', null),
  ('a0000000-0000-4000-8000-000000000004', 'Arancini',           'Saffron risotto, mozzarella',            'starter', null),
  ('a0000000-0000-4000-8000-000000000004', 'Cacio e pepe',       'Tonnarelli, pecorino, black pepper',     'main',    null),
  -- Deliberate near-duplicate so the moderation queue has something in it.
  ('a0000000-0000-4000-8000-000000000004', 'Cacio e peppe',      null,                                     'main',    null),
  ('a0000000-0000-4000-8000-000000000004', 'Pappardelle al ragù', 'Slow-cooked beef and pork ragù',        'main',    null),
  ('a0000000-0000-4000-8000-000000000004', 'Margherita pizza',   'San Marzano, fior di latte',             'main',    null),
  ('a0000000-0000-4000-8000-000000000004', 'Tiramisù',           null,                                     'dessert', null),
  ('a0000000-0000-4000-8000-000000000004', 'Negroni',            null,                                     'drink',   null),
  -- Saffron Table
  ('a0000000-0000-4000-8000-000000000005', 'Samosa chaat',       'Chickpeas, tamarind, yogurt',            'starter', null),
  ('a0000000-0000-4000-8000-000000000005', 'Butter chicken',     'Tomato-cream sauce, fenugreek',          'main',    null),
  ('a0000000-0000-4000-8000-000000000005', 'Lamb rogan josh',    'Kashmiri chili, slow-braised',           'main',    null),
  ('a0000000-0000-4000-8000-000000000005', 'Palak paneer',       null,                                     'main',    null),
  ('a0000000-0000-4000-8000-000000000005', 'Garlic naan',        null,                                     null,      null),
  ('a0000000-0000-4000-8000-000000000005', 'Gulab jamun',        'Cardamom syrup',                         'dessert', null),
  ('a0000000-0000-4000-8000-000000000005', 'Mango lassi',        null,                                     'drink',   null),
  -- Pecan Street Café
  ('a0000000-0000-4000-8000-000000000006', 'Fried green tomatoes', 'Remoulade',                            'starter', null),
  ('a0000000-0000-4000-8000-000000000006', 'Chicken-fried steak', 'Cream gravy, mashed potatoes',          'main',    null),
  ('a0000000-0000-4000-8000-000000000006', 'Smash burger',       'Double patty, American cheese, pickles', 'main',    null),
  ('a0000000-0000-4000-8000-000000000006', 'Pecan pie',          null,                                     'dessert', null),
  ('a0000000-0000-4000-8000-000000000006', 'Cold brew',          null,                                     'drink',   null);
