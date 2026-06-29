import { createSignal } from "solid-js";

import { useNavigate, Navigate } from "@solidjs/router";
import { Icon } from "solid-heroicons";
import { envelope, lockClosed, user, xCircle, chatBubbleOvalLeft, eyeSlash, eye } from "solid-heroicons/outline";
import { authClient } from "~/client/utils/auth-client";

export component Auth() {
  const navigate = useNavigate();
  const [isLogIn, setIsLogIn] = createSignal(true);
  const session = authClient.useSession();
  const [showPassword, setShowPassword] = createSignal(false);
  const [formData, setFormData] = createSignal({
    email: "",
    password: "",
    username: "",
  });

  const handleChange = (e: any) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const data = formData();

    try {
      if (isLogIn()) {
        const { data: result, error } = await authClient.signIn.email({
          email: data.email,
          password: data.password,
        });

        if (error) {
          alert("Đăng nhập thất bại: " + error.message);
          return;
        }

        alert("Đăng nhập thành công!");
        navigate("/"); // Use solid router to navigate instead of reload if possible, but reload works too
        window.location.reload();
      } else {
        const { data: result, error } = await authClient.signUp.email({
          email: data.email,
          password: data.password,
          name: data.username,
        });

        if (error) {
          alert("Đăng ký thất bại: " + error.message);
          return;
        }

        alert("Đăng ký thành công!");
        setIsLogIn(true);
      }
    } catch (err) {
      alert("Lỗi kết nối đến server");
      console.error(err);
    }
  };

  const sessionData = session();
  if (sessionData && sessionData.data && sessionData.data.user) {
    <Navigate href="/" />
  } else {
    <div class="flex justify-center items-center min-h-screen bg-transparent py-8 transition-colors duration-300">
      <form
        onSubmit={handleSubmit}
        class={`relative w-full max-w-sm p-6 bg-white rounded-xl shadow-2xl space-y-6 transition-all duration-300 border border-gray-100/20 ${
          isLogIn() ? "border-l-4 border-blue-500" : "border-l-4 border-green-500"
        }`}>
        if (isLogIn()) {
          <h2 class="text-2xl font-semibold text-center text-gray-800 dark:text-white transition-colors">{"Đăng nhập"}</h2>
          <div class="space-y-4">
            <div
              class="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-transparent focus-within:border-blue-500 dark:focus-within:border-blue-400 transition-colors">
              <Icon path={envelope} class="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <input
                type="email"
                id="email"
                placeholder="Email"
                required
                onInput={handleChange}
                class="w-full pl-3 py-2 outline-none bg-transparent dark:text-white dark:placeholder-gray-400"
              />
            </div>
            <div
              class="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-transparent focus-within:border-blue-500 dark:focus-within:border-blue-400 transition-colors">
              <Icon path={lockClosed} class="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <input
                type={showPassword() ? "text" : "password"}
                id="password"
                placeholder="Mật khẩu"
                required
                onInput={handleChange}
                class="w-full pl-3 py-2 outline-none bg-transparent dark:text-white dark:placeholder-gray-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword())}
                class="text-gray-500 dark:text-gray-400 hover:text-gray-700 focus:outline-none ml-2">
                <Icon path={showPassword() ? eyeSlash : eye} class="w-5 h-5" />
              </button>
            </div>
            <div class="flex justify-between items-center px-1">
              <div class="flex items-center gap-2 group">
                <input
                  type="checkbox"
                  id="rememberMe"
                  class="w-4 h-4 text-blue-500 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 focus:ring-blue-500 cursor-pointer"
                />
                <label
                  for="rememberMe"
                  class="text-sm font-medium text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors cursor-pointer">
                  {"Lưu đăng nhập"}
                </label>
              </div>
              <u
                onClick={() => setIsLogIn(false)}
                class="text-sm text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 cursor-pointer transition-colors font-semibold">
                {"Bạn chưa có tài khoản?"}
              </u>
            </div>
            <input
              type="submit"
              value="Đăng nhập"
              class="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition duration-200"
            />
          </div>
        } else {
          <span
            class="absolute top-3 right-3 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer transition-colors"
            onClick={() => setIsLogIn(true)}>
            <Icon path={xCircle} class="w-6 h-6" />
          </span>
          <h2 class="text-2xl font-semibold text-center text-gray-800 dark:text-white transition-colors">{"Đăng ký"}</h2>
          <div class="space-y-4">
            <div
              class="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-transparent focus-within:border-green-500 dark:focus-within:border-green-400 transition-colors">
              <Icon path={user} class="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <input
                type="text"
                id="username"
                placeholder="Tên người dùng"
                required
                onInput={handleChange}
                class="w-full pl-3 py-2 outline-none bg-transparent dark:text-white dark:placeholder-gray-400"
              />
            </div>
            <div
              class="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-transparent focus-within:border-green-500 dark:focus-within:border-green-400 transition-colors">
              <Icon path={envelope} class="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <input
                type="email"
                id="email"
                placeholder="Email"
                required
                onInput={handleChange}
                class="w-full pl-3 py-2 outline-none bg-transparent dark:text-white dark:placeholder-gray-400"
              />
            </div>
            <div
              class="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-transparent focus-within:border-green-500 dark:focus-within:border-green-400 transition-colors">
              <Icon path={lockClosed} class="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <input
                type={showPassword() ? "text" : "password"}
                id="password"
                placeholder="Mật khẩu"
                required
                onInput={handleChange}
                class="w-full pl-3 py-2 outline-none bg-transparent dark:text-white dark:placeholder-gray-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword())}
                class="text-gray-500 dark:text-gray-400 hover:text-gray-700 focus:outline-none ml-2">
                <Icon path={showPassword() ? eyeSlash : eye} class="w-5 h-5" />
              </button>
            </div>
            <input
              type="submit"
              value="Đăng ký"
              class="w-full py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition duration-200"
            />
          </div>
        }
      </form>
    </div>
  }
}
