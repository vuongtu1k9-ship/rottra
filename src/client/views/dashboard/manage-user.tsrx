import { createSignal, createResource } from "solid-js";
import { Profile } from "../profile.tsrx";
import { AdminActions } from "./admin-actions.tsrx";
import { Icon } from "solid-heroicons";
import { checkBadge } from "solid-heroicons/outline";

const fetchUsers = async () => {
  const res = await fetch("/api/admin/users");
  if (!res.ok) return [];
  const data = await res.json();
  return data.users || [];
};

export component ManageUsers(props: any) {
  const [usersData, { refetch }] = createResource(fetchUsers);

  const [selectedUsers, setSelectedUsers] = createSignal<any[]>([]);
  const [activeSubAgentId, setActiveSubAgentId] = createSignal<string | null>(null);

  const toggleSelect = (user: any) => {
    if (selectedUsers().find((u) => u.email === user.email)) {
      setSelectedUsers(selectedUsers().filter((u) => u.email !== user.email));
    } else {
      setSelectedUsers([...selectedUsers(), user]);
    }
  };

  const selectAll = () => {
    if (selectedUsers().length === usersData()?.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(usersData() || []);
    }
  };
  <tsx><div class="p-6 space-y-6 animate-in fade-in duration-500">
    <header class="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
      <div class="flex items-center gap-6">
        <div>
          <h2 class="text-2xl font-bold text-gray-800">
            {"Quản lý người dùng"}
          </h2>
          <p class="text-sm text-gray-500">
            {"Đã chọn: "}
            <span class="font-bold text-blue-600">
              {selectedUsers().length}
            </span>
            {" / "}
            {usersData()?.length || 0}
          </p>
        </div>
        <button
          onClick={selectAll}
          class="px-4 py-2 text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-colors">
          {selectedUsers().length === usersData()?.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
        </button>
      </div>
    </header>
    {}
    <AdminActions
      role={props.role}
      selectedUsers={selectedUsers()}
      onActionComplete={() => {
        setSelectedUsers([]);
        refetch();
      }}
    />
    {}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {usersData.loading
        ? <div class="col-span-full p-8 text-center text-gray-400 italic">
            {"Đang tải dữ liệu..."}
          </div>
        : usersData()?.length === 0
          ? <div class="col-span-full p-8 text-center text-gray-400 italic">
              {"Chưa có dữ liệu người dùng."}
            </div>
          : ((usersData() || []).filter((u: any) => u.role === "admin" || u.role === "agent" || u.id === "RottraAI").map(
              (user: any) => (user.role === "agent" || user.id === "RottraAI"
                ? <>
                    <div class="flex flex-col items-center gap-2">
                      {}
                      {(() => {
                        const targetUser =
                          (activeSubAgentId() ? (usersData() || []).find((u) => u.id === activeSubAgentId()) : null) || user;
                        return <>
                          <div
                            onClick={() => toggleSelect(user)}
                            class={`w-full cursor-pointer transition-all duration-300 rounded-3xl relative group ${
                              selectedUsers().find((u) => u.email === user.email)
                                ? "ring-4 ring-blue-500 scale-[1.02] shadow-xl"
                                : "hover:scale-[1.01]"
                            }`}>
                            <div
                              class={`absolute top-4 left-4 z-10 w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                                selectedUsers().find((u) => u.email === user.email)
                                  ? "bg-blue-500 border-blue-500 text-white"
                                  : "bg-white/50 border-gray-200 opacity-0 group-hover:opacity-100"
                              }`}>
                              {selectedUsers().find((u) => u.email === user.email)
                                ? <Icon path={checkBadge} class="w-5 h-5 text-white" />
                                : null}
                            </div>
                            <Profile
                              user={targetUser}
                              isMini={true}
                              activeSubAgentId={activeSubAgentId()}
                              setActiveSubAgentId={setActiveSubAgentId}
                            />
                          </div>
                        </>;
                      })()}
                    </div>
                  </>
                : <>
                    <div
                      onClick={() => toggleSelect(user)}
                      class={`cursor-pointer transition-all duration-300 rounded-3xl relative group ${
                        selectedUsers().find((u) => u.email === user.email)
                          ? "ring-4 ring-blue-500 scale-[1.02] shadow-xl"
                          : "hover:scale-[1.01]"
                      }`}>
                      <div
                        class={`absolute top-4 left-4 z-10 w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                          selectedUsers().find((u) => u.email === user.email)
                            ? "bg-blue-500 border-blue-500 text-white"
                            : "bg-white/50 border-gray-200 opacity-0 group-hover:opacity-100"
                        }`}>
                        {selectedUsers().find((u) => u.email === user.email) ? <Icon path={checkBadge} class="w-5 h-5 text-white" /> : null}
                      </div>
                      <Profile user={user} isMini={true} />
                    </div>
                  </>),
            ))}
    </div>
  </div></tsx>
};
