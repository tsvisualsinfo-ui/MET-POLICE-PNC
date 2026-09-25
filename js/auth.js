async function login(){
  const errorBox=document.getElementById("error");
  errorBox.style.display="none";
  const {data,error}=await sb.auth.signInWithPassword({
    email:document.getElementById("email").value.trim(),
    password:document.getElementById("password").value
  });
  if(error){errorBox.textContent=error.message;errorBox.style.display="block";return;}
  const {data:officer}=await sb.from("officers").select("*").eq("id",data.user.id).maybeSingle();
  if(!officer || !officer.active){
    await sb.auth.signOut();
    errorBox.textContent="No active PRC officer profile is linked to this account.";
    errorBox.style.display="block";
    return;
  }
  location.href="dashboard.html";
}
sb.auth.getSession().then(({data})=>{
  if(data.session) location.href="dashboard.html";
});
