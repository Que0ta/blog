import express from "express";
import bodyParser from "body-parser";
import env from "dotenv";
import { createClient } from '@supabase/supabase-js';
import session from "express-session";

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
// встановлюємо статичну папку для елементів сайту (фото, стилі)
app.use(express.static("public"));
// Для підлкючення env файлу
env.config();

// Налаштування сесій для збереження логіну
app.use(session({
    secret: process.env.sesion_key, 
    resave: false,
    saveUninitialized: false
}));

// Підключення до бази даних
const supabaseUrl = process.env.PROJECT_URL;
const supabaseKey = process.env.API_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

app.get('/', (req, res) => {
    // перенаправлення на реєстрацію або вхід через наявну сесію
    const username = req.session.username;  // змінна для перевірки сесії

    if (username) {
        // якщо залогінений перекидує в блог
        return res.redirect('/blog');
    }

    // інакше просто закидує в реєстраційну форму
    res.redirect('/register');
});

// Отримуємо сторінку для логіну
app.get('/login', (req, res) => {
    res.render('authorisation.ejs', { page: 'login', message: null, success: null, username: 'resUser' });
});

app.get('/new', (req, res) => {
    res.render('form.ejs');
});

// Отримуємо сторінку для реєстрації
app.get('/register', (req, res) => {
    // Render the register page with no message initially
    res.render('authorisation.ejs', { page: 'register', message: null, success: null });
});

// Сторінка блогу
app.get('/blog', (req, res) => {
    const username = req.session.username;

    if (!username) {
        return res.redirect('/login'); // Перенаправлення, якщо користувач не ввійшов
    }

    res.render('blog.ejs', { username });
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error(err);
            return res.redirect('/blog');
        }

        res.redirect('/login');
    });
});


// авторизація та реєстрація
app.post('/login', async (req, res) => {
    const emailInput = req.body.email;
    const passwordInput = req.body.password;

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('email, password, username')
            .eq('email', emailInput)
            .single();

        if (!user) {
            return res.render('authorisation.ejs', {
                page: 'login',
                message: 'User with this email does not exist.',
                success: false,
            });
        }

        if (user.password !== passwordInput) {
            return res.render('authorisation.ejs', {
                page: 'login',
                message: 'Invalid password. Please try again.',
                success: false,
            });
        }

        // Збереження даних у сесію
        req.session.username = user.username;

        // Перехід на сторінку блогу
        res.redirect('/blog');
    } catch (err) {
        console.error(err);
        res.render('authorisation.ejs', {
            page: 'login',
            message: 'An unexpected error occurred.',
            success: false,
        });
    }
});



app.post('/register', async (req, res) => {
    const usernameInput = req.body.username;
    const emailInput = req.body.email;
    const passwordInput = req.body.password;

    try {
        // перевірка на повторюючого юзера
        const { data: existingUser, error: usernameError } = await supabase
            .from('users')
            .select('username')
            .eq('username', usernameInput)
            .single();

        if (existingUser) {
            // якщо такий юзер вже існує
            return res.render('authorisation.ejs', {
                page: 'register',
                message: 'Username is already taken. Please choose another.',
                success: false,
            });
        }

        // Отримуємо інфу з таблиці. А потім перевіряємо чи присутня така сама ж, якщо немає тоді переходимо до наступного кроку
        const { data: existingEmail, error: emailError } = await supabase
            .from('users')
            .select('email')
            .eq('email', emailInput)
            .single();


        if (existingEmail) {
            // якщо пошта вже існує в базі даних
            return res.render('authorisation.ejs', {
                page: 'register',
                message: 'Email is already registered. Please use another.',
                success: false,
            });
        }

        // закидуємо нову інформацію у базу даних
        const { data, error } = await supabase
            .from('users')
            .insert([{ username: usernameInput, email: emailInput, password: passwordInput }]);
        // помилка пов'язана з базою даних
        if (error) {
            console.error(error);
            return res.render('authorisation.ejs', {
                page: 'register',
                message: 'Registration failed. Please try again.',
                success: false,
            });
        }

        // Успішна реєстрація + обновлення сторінки register та показ message 
        res.render('authorisation.ejs', {
            page: 'register',
            message: 'Registration successful!',
            success: true,
        });
    } catch (err) {
        console.error(err);
        res.render('authorisation.ejs', {
            page: 'register',
            message: 'An unexpected error occurred.',
            success: false,
        });
    }
});

// перевірка web status'а
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
  