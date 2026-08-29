import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function OnboardingPage() {
  
  // 🌟 SERVER ACTION: Complete the Workspace Setup
  const completeSetup = async (formData) => {
    'use server'
    const fullName = formData.get('fullName')
    const companyName = formData.get('companyName')
    
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return redirect('/login')

    // 1. Update auth metadata so the Middleware bouncer lets them pass
    await supabase.auth.updateUser({
      data: {
        full_name: fullName,
        company_name: companyName,
      }
    })

    // 2. Create the Organization in your public database
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: companyName })
      .select()
      .single()

    // 3. Update the public user profile and link them to the organization
    if (org && !orgError) {
      await supabase
        .from('users')
        .update({ full_name: fullName })
        .eq('id', user.id);

      await supabase
        .from('organization_members')
        .insert({
          org_id: org.id,
          user_id: user.id,
          role: 'admin' // Creator gets admin role
        });
    }

    // 4. Release them into the Dashboard!
    return redirect('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brutal-bg p-4 font-sans">
      <div className="max-w-md w-full bg-white border-4 border-black shadow-brutal-lg p-10 flex flex-col space-y-8">
        
        <div className="text-center border-b-4 border-black pb-6">
          <div className="mx-auto h-16 w-16 bg-brutal-green border-4 border-black flex items-center justify-center mb-6 shadow-brutal hover:-translate-y-1 transition-transform">
            <span className="text-3xl font-black">!</span>
          </div>
          <h2 className="text-4xl font-black uppercase tracking-tight text-black">Workspace Init</h2>
          <p className="mt-4 text-sm font-bold font-mono text-black">CONFIGURE YOUR ENVIRONMENT</p>
        </div>

        <form className="space-y-6" action={completeSetup}>
          
          <div className="space-y-6">
            <div>
              <label htmlFor="companyName" className="block font-black text-xl mb-2 uppercase text-black">
                Organization Name
              </label>
              <input 
                id="companyName" 
                name="companyName" 
                type="text" 
                required 
                placeholder="Acme Corp" 
                className="input-brutal"
              />
              <p className="mt-2 text-xs font-mono font-bold text-gray-500">This will be your workspace identifier.</p>
            </div>

            <div>
              <label htmlFor="fullName" className="block font-black text-xl mb-2 uppercase text-black">
                Your Name
              </label>
              <input 
                id="fullName" 
                name="fullName" 
                type="text" 
                required 
                placeholder="Jane Doe" 
                className="input-brutal"
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn-brutal w-full py-4 bg-brutal-green text-2xl mt-4 text-black"
          >
            ENTER SYSTEM &rarr;
          </button>
        </form>

      </div>
    </div>
  )
}