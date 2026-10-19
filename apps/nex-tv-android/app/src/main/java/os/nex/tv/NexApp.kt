package os.nex.tv

import android.app.Application

class NexApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Agent.start(this)
    }
}
