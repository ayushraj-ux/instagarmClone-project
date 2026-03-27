// const dotenv = require('dotenv')
const express = require('express')
const app = express();
const cors = require('cors')
const connectDB = require("./config/db");
const bcrypt = require("bcrypt");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const userDetail = require('./modal/userDetail');
const userRegister = require('./modal/register.model');
const registerModel = require('./modal/register.model');
const postModal = require('./modal/post.model')

const verifyUser = require("./middleware/auth.middleware");
const {UploadFile} = require('./service/imageKit')

const {PostFile} = require('./service/postImage');

const multer = require("multer");


 // Multer configuration for file upload
const storage = multer.memoryStorage();

const upload = multer({ storage: storage });

 app.use(express.json());
 app.use(express.urlencoded({ extended: true }));
 app.use(cookieParser());
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true, // ✅ VERY IMPORTANT
}));
connectDB();







//////////////////////////////////////
app.post("/register", async (req, res) => {
  try {

    const { userName, email, password } = req.body;

    // check if user already exists
    const existingUser = await userRegister.findOne({ email });

    if (existingUser) {
      return res.json({
        message: "User already exists",
        

      });
    }

    // hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // create user
    const user = await userRegister.create({
      userName,
      email,
      password: hashedPassword
    });

    await userDetail.create({
      deatailId:user._id,
      profileImage : null,
      name : "",
      userName: user.userName,
      pronoun: "",
      bio : "",
      post:[],
      following:[],
      followers:[],
      gender:null
    })
    // create token
    const token = jwt.sign(
  { id: user._id },
  "secretkey",
  { expiresIn: "7d" }
);

    // save cookie
 res.cookie("token", token, {
  httpOnly: true,
  secure: false,
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000
});

    res.json({
      message: "User registered successfully",
      user
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
});



app.post('/login',async (req, res) => {
  try {

    const { emailOrName, password } = req.body;

    // find user by email
   const user = await userRegister.findOne({
  $or: [
    { email: emailOrName },
    { userName: emailOrName}
  ]
});



    if (!user) {
      return res.json({
        message: "Invalid email or password"
      });
    }

    // compare password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.json({ message: "Invalid email or password" });
    }

    // create token
    const token = jwt.sign({ id: user._id }, "secretkey", { expiresIn: "7d" });

    // store cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      message: "Login successful"
    });

  } catch (error) {
    console.log(error);
  }
});







app.patch("/detail", upload.single("img"),verifyUser, async (req, res) => {
  try {

    // console.log(req.body);
    // console.log(req.file);
    const decoded_id = req.user.id
    const { name, userName, pronoun, bio, gender } = req.body;

    let updateData = {
      name,
      userName,
      pronoun,
      bio,
      gender
    };

    if (req.file) {
      const result = await UploadFile(req.file.buffer.toString("base64"));
      updateData.profileImage = result.url;
    }

    const updatedUser = await userDetail.findOneAndUpdate(
      { deatailId: decoded_id },
      { $set: updateData },
      { returnDocument: "after" }
    );
   const registerUSer = await registerModel.findOneAndUpdate(
      { _id: decoded_id },
      { $set: {
        userName
      } },
      { returnDocument: "after" }
    )
    // console.log(registerUSer);
    

    res.status(200).json({
      message: "Data updated",
      updatedUser,
      registerUSer
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "server error" });
  }
});





app.get("/getDetail", verifyUser,async (req,res)=>{
  try {
    
const decoded_id = req.user.id
    const detail = await userDetail.findOne({
      deatailId: decoded_id
    })
    const user = await registerModel.findOne({
        _id:  decoded_id
    })

    res.json({
      message:"data fetch successfully",
   detail,
   user
    })

    // console.log(detail);
    

  } catch (error) {
    console.log(error);
    
  }
})
app.get("/getUser/:id", verifyUser, async (req, res) => {
  try {
    const userId = req.params.id;
    const detail = await userDetail.findById(userId);
// console.log(detail);

    res.json({detail});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



app.post("/logOut",(req,res)=>{
try {
  
       res.clearCookie("token");
    res.json({
      message:"logged Out successfully",
    })
    
  
} catch (error) {
  res.status(500).json({
    message: "internal server problem"
  })
}
})

////////////////////////////////////////////////////////////////////////////////////////////////////


app.post("/createPost", upload.single('image'), verifyUser, async (req, res) => {
  try {
    const decoded_id = req.user.id;

    const { caption, description, type } = req.body;

    // 🔥 STEP 1: get UserDetail
    const currentUser = await userDetail.findOne({
      deatailId: decoded_id
    });

    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // 🔥 STEP 2: create post with correct ID
    let postData = {
      deatailId: currentUser._id,   // ✅ FIXED
      caption,
      description,
      type
    };

    if (req.file) {
      const result = await PostFile(req.file.buffer.toString("base64"));
      postData.postImage = result.url;
    }

    const postDetail = await postModal.create(postData);

    // 🔥 STEP 3: update user posts
    await userDetail.findByIdAndUpdate(
      currentUser._id,
      { $addToSet: { post: postDetail._id } }
    );

    res.status(201).json({
      message: "New post created",
      postDetail
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error creating post" });
  }
});


app.get('/getPost', verifyUser, async (req, res) => {
  try {
    const decoded_id = req.user.id;

    // 🔹 Step 1: find UserDetail
    const currentUser = await userDetail.findOne({
      deatailId: decoded_id
    });

    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // 🔹 Step 2: fetch posts using UserDetail._id
    const post = await postModal.find({
      deatailId: currentUser._id   // ✅ FIXED
    })
    .sort({ createdAt: -1 })
    .populate("deatailId", "userName profileImage");

    res.status(200).json({
      message: "post fetched successful",
      post
    });

  } catch (error) {
    res.status(500).json({
      message: "Error fetching posts",
      error: error.message
    });
  }
});


app.get('/getPost/:id', verifyUser, async (req, res) => {
  const User = req.params.id

  const postDetail = await userDetail.findById(User).populate("post")


res.json({
  message : "checking",
 post : postDetail.post
})

});



app.get("/post/:id",async(req,res)=>{
         const userId = req.params.id;
    // verify token
    const detail = await postModal.findOne({
      _id:userId
    })
    
    res.json({
      meessage : "post fetched successfully",
      detail
    })

})




//////////////////////////////////////////////////////////////////////////////////////////////////////




app.get('/feedPost', verifyUser, async (req, res) => {
  try {
    // 🔹 Step 1: get current userDetail using logged-in user id
    const currentUser = await userDetail.findOne({
      deatailId: req.user.id   // from token
    });

    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // 🔹 Step 2: get following + self
    const followingUsers = [...currentUser.following, currentUser._id];

    // console.log(followingUsers);
    
    // 🔹 Step 3: fetch posts
    const feedPost = await postModal.find({
      deatailId: { $in: followingUsers }
    })
    .sort({ createdAt: -1 })
    .populate({
      path: "deatailId",
      select: "userName profileImage name"
    });


    
    res.status(200).json({
      message: "Feed fetched successfully",
      feedPost,
  
    });

  } catch (error) {
    res.status(500).json({
      message: "Error fetching feed",
      error: error.message
    });
  }
});


app.delete("/deletePost/:id", verifyUser, async (req, res) => {
  try {
    const decoded_id = req.user.id;
    const postId = req.params.id;

    // 🔹 Step 1: find current userDetail
    const currentUser = await userDetail.findOne({
      deatailId: decoded_id
    });

    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // 🔹 Step 2: find post
    const post = await postModal.findById(postId);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // 🔒 Step 3: check ownership
    if (post.deatailId.toString() !== currentUser._id.toString()) {
      return res.status(403).json({
        message: "You are not allowed to delete this post"
      });
    }

    // 🔹 Step 4: delete post
    await postModal.findByIdAndDelete(postId);

    // 🔹 Step 5: remove post from userDetail.post array
    await userDetail.findByIdAndUpdate(
      currentUser._id,
      {
        $pull: { post: postId }   // 🔥 removes postId from array
      }
    );

    res.status(200).json({
      message: "Post deleted successfully"
    });

  } catch (error) {
    res.status(500).json({
      message: "Error deleting post",
      error: error.message
    });
  }
});








/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

app.get("/searchUser", verifyUser, async (req, res) => {
  try {
    const currentUser = await userDetail.findOne({
      deatailId: req.user.id
    });

    // 🔹 get all users except current
    const users = await userDetail.find({
      _id: { $ne: currentUser._id }
    }).select("userName profileImage");

    // 🔹 get following ids
    const followingIds = currentUser.following.map(id => id.toString());

    // 🔥 attach isFollow to each user
    const updatedUsers = users.map(user => ({
      ...user._doc,
      isFollow: followingIds.includes(user._id.toString())
    }));

    res.status(200).json({
      users: updatedUsers
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
});



app.post("/AddFollowing/:id", verifyUser, async (req, res) => {
  try {
    const currentUser = await userDetail.findOne({
      deatailId: req.user.id
    });

    const currentUserId = currentUser._id;
    const followUserId = req.params.id;

    // ❌ prevent self follow
    if (currentUserId.toString() === followUserId) {
      return res.status(400).json({ message: "You can't follow yourself" });
    }

    // ✅ add to following
    await userDetail.findByIdAndUpdate(currentUserId, {
      $addToSet: { following: followUserId }
    });

    // ✅ add to followers
    await userDetail.findByIdAndUpdate(followUserId, {
      $addToSet: { followers: currentUserId }
    });

    res.json({ message: "Followed successfully" });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/unFollowUser/:id", verifyUser, async (req, res) => {
  try {
    const currentUser = await userDetail.findOne({
      deatailId: req.user.id
    });

    const currentUserId = currentUser._id;
    const unfollowUserId = req.params.id;

    // ✅ remove from following
    await userDetail.findByIdAndUpdate(currentUserId, {
      $pull: { following: unfollowUserId }
    });

    // ✅ remove from followers
    await userDetail.findByIdAndUpdate(unfollowUserId, {
      $pull: { followers: currentUserId }
    });

    res.json({ message: "Unfollowed successfully" });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
});


app.get("/Allfollower", verifyUser, async (req, res) => {
  try {
  
    const currentUserId = req.user.id // from token 

    // 🔹 get logged-in user
    const currentUser = await userDetail.findOne(
     { deatailId : currentUserId}
    );

    // 🔹 get followers (full data)



    const followers = await userDetail.find({
      _id: { $in: currentUser.followers }
    }).select("userName profileImage");

    // 🔹 get following ids only
    const followingIds = currentUser.following.map(id => id.toString());

    res.status(200).json({
      followers,
      followingIds
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
});




app.get("/Allfollowing", verifyUser, async (req, res) => {
  try {
        const User = await userDetail.findOne({
      deatailId: req.user.id
    });

    const currentUserId = User._id;

    // 🔹 get logged-in user
    const currentUser = await userDetail.findById(currentUserId);

    // console.log(currentUser);
    
    const following = await userDetail.find({
      _id: { $in: currentUser.following }
    }).select("userName profileImage");

   res.status(200).json({ following });

  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
});




/////////////////////////////////////////////////////////////////////////////////////////////////////////////

















app.listen(3000, () => {
  console.log("Server running on port 3000");
});




