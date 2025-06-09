const bcrypt = require('bcrypt');
bcrypt.hash('AdminPassword123', 10, (err, hash) => console.log(hash));